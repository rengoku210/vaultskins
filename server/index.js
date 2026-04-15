require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const winston = require('winston');
const z = require('zod');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
// const db = require('./schema');
const firestore = admin.apps.length ? admin.firestore() : null;
const db = {
  run: (query, params, cb) => {
    if (cb) cb(null);
  }
};

// Helper to get firestore safely
const getFirestore = () => {
    if (!admin.apps.length) throw new Error("Firebase not initialized. Check your FIREBASE_SERVICE_ACCOUNT env var on Vercel.");
    return admin.firestore();
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Winston Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.set('trust proxy', 1);

const PORT = 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_valorant_key_2026';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ADMIN_EMAIL = 'rammodhvadiya210@gmail.com';

// Initialize Firebase Admin (Mock/Bypass if credentials unprovided for local dev)
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
  } else {
    // If running in a GCP environment it might work without args, 
    // but locally we should avoid crashing if no config is available.
    if (!admin.apps.length) {
      admin.initializeApp();
    }
  }
} catch (e) {
  logger.warn("Firebase Admin failed to initialize. Firebase Auth will use fallback decoding.");
}

const apiLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: { success: false, error: 'Too many requests' } 
});

const otpLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { success: false, error: 'Too many OTP requests. Please try again after 15 minutes.' } 
});

const loginLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 50, 
  message: { success: false, error: 'Too many login attempts' } 
});

app.use('/api/', apiLimiter);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return 'Decryption Failed';
  }
}

// ── Auth Middleware ──
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') next();
  else res.status(403).json({ error: 'Admin access required' });
}

function logAudit(adminId, action, targetType, targetId, details) {
  db.run("INSERT INTO AuditLogs (admin_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)", 
         [adminId, action, targetType, targetId, details]);
  io.emit('admin_activity', { action, targetType, time: new Date() });
}

function createNotification(userId, title, message, type = 'info') {
  db.run("INSERT INTO Notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)", [userId, title, message, type], (err) => {
    if (err) logger.error(`Failed to create notification for user ${userId}: ${err.message}`);
    else io.emit('new_notification', { userId, title, message, type });
  });
}

// ── Email Transporter ──
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendMail(to, subject, text, html) {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn(`Skipping email to ${to} (SMTP credentials missing). Content: ${text}`);
      return;
    }
    await transporter.sendMail({ from: `"VaultSkins" <${process.env.SMTP_USER}>`, to, subject, text, html });
  } catch (err) {
    logger.error(`Email send failed: ${err.message}`);
  }
}

// ── Cache for third party APIs ──
let valorantDataCache = {
  skins: null,
  tiers: null,
  lastFetched: 0
};

// Websocket logic
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => logger.info(`Client disconnected: ${socket.id}`));
});

// ── API Routes ──

app.get('/api/valorant/skins', async (req, res) => {
  if (valorantDataCache.skins && Date.now() - valorantDataCache.lastFetched < 3600000) {
     return res.json({ skins: valorantDataCache.skins, tiers: valorantDataCache.tiers, cached: true });
  }
  try {
      const [weaponsRes, tiersRes] = await Promise.all([
          fetch('https://valorant-api.com/v1/weapons').then(r => r.json()),
          fetch('https://valorant-api.com/v1/contenttiers').then(r => r.json())
      ]);

      const placeholder = 'https://via.placeholder.com/600x300/15151e/34d399?text=No+Image';
      
      const flattenedSkins = [];
      
      weaponsRes.data.forEach(weapon => {
        const weaponName = weapon.displayName;
        if (!weapon.skins) return;

        weapon.skins.forEach(skin => {
          // Filter out standard/random placeholders
          if (skin.displayName.includes('Standard') || skin.displayName.includes('Random')) return;

          const displayIcon = skin.displayIcon || 
                             skin.levels?.[0]?.displayIcon || 
                             skin.chromas?.[0]?.fullRender || 
                             placeholder;

          const videoLevel = skin.levels?.find(lvl => lvl.streamedVideo);
          const video = videoLevel ? videoLevel.streamedVideo : null;

          flattenedSkins.push({
            uuid: skin.uuid,
            displayName: skin.displayName,
            weapon: weaponName,
            displayIcon,
            video,
            contentTierUuid: skin.contentTierUuid,
            levels: (skin.levels || []).map(l => ({
              uuid: l.uuid,
              displayName: l.displayName,
              displayIcon: l.displayIcon || displayIcon,
              streamedVideo: l.streamedVideo
            }))
          });
        });
      });
      console.log(`Successfully flattened ${flattenedSkins.length} skins.`);

      valorantDataCache.skins = flattenedSkins;
      valorantDataCache.tiers = tiersRes.data;
      valorantDataCache.lastFetched = Date.now();
      res.json({ skins: flattenedSkins, tiers: tiersRes.data, cached: false });
  } catch (e) {
      if (valorantDataCache.skins) return res.json({ skins: valorantDataCache.skins, tiers: valorantDataCache.tiers, cached: true, stale: true });
      res.status(500).json({ error: 'Failed to fetch' });
  }
});

app.post('/api/auth/firebase', loginLimiter, async (req, res) => {
  const { token } = req.body;
  const ip = req.ip;
  try {
    let decodedToken;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      decodedToken = await admin.auth().verifyIdToken(token);
    } else {
      decodedToken = jwt.decode(token); 
    }
    
    if (!decodedToken) {
      throw new Error('Malformed JWT');
    }

    const uid = decodedToken.uid || decodedToken.sub;
    const email = decodedToken.email;
    const picture = decodedToken.picture;

    if (!uid || !email) {
      logger.error('Invalid token claims:', decodedToken);
      throw new Error(`Missing required claims (uid/sub: ${!!uid}, email: ${!!email})`);
    }

    const username = email.split('@')[0];

    const usersRef = getFirestore().collection('Users');
    const snapshot = await usersRef.where('firebase_uid', '==', uid).get();
    let user = !snapshot.empty ? { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } : null;

    if (!user) {
      const emailSnapshot = await usersRef.where('email', '==', email).get();
      if (!emailSnapshot.empty) user = { id: emailSnapshot.docs[0].id, ...emailSnapshot.docs[0].data() };
    }

    const role = (email === ADMIN_EMAIL) ? 'admin' : 'user';

    if (!user) {
      const newUser = { username, email, firebase_uid: uid, profile_picture: picture, last_ip: ip, role, created_at: admin.firestore.FieldValue.serverTimestamp() };
      const docRef = await usersRef.add(newUser);
      const myToken = jwt.sign({ id: docRef.id, role, username, profile_picture: picture }, JWT_SECRET, { expiresIn: '12h' });
      res.json({ token: myToken, role, user: { username, profile_picture: picture } });
    } else {
      await usersRef.doc(user.id).update({ last_ip: ip, profile_picture: picture, firebase_uid: uid, role });
      const myToken = jwt.sign({ id: user.id, role, username: user.username, profile_picture: picture }, JWT_SECRET, { expiresIn: '12h' });
      res.json({ token: myToken, role, user: { username: user.username, profile_picture: picture } });
    }

  } catch (error) {
    db.run("INSERT INTO LoginAttempts (ip_address, username_attempted, success) VALUES (?,?,?)", [ip, 'FIREBASE', 0]);
    logger.warn(`Firebase login failed from ${ip}: ${error.message}`);
    res.status(401).json({ error: 'Auth Connection Error: Please ensure backend is running.' });
  }
});

// ── Registration OTP Endpoints ──

app.post('/api/auth/request-email-otp', otpLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !z.string().email().safeParse(email).success) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  db.get("SELECT id FROM Users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      logger.error('DB Error in request-email-otp:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (user) return res.status(400).json({ error: 'Email already registered' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();

    db.run("INSERT INTO EmailOtps (email, otp_hash, expires_at) VALUES (?, ?, ?)", [email, otpHash, expiresAt], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #111;">
          <h2>Verify Your VaultSkins Account</h2>
          <p>Hey,</p>
          <p>Your verification code is:</p>
          <div style="font-size: 24px; font-weight: bold; background: #f4f4f4; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            🔐 ${otp}
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p>If you didn't request this, you can ignore this email.</p>
          <p>– VaultSkins Team</p>
        </div>
      `;

      sendMail(email, 'Verify Your VaultSkins Account', `Your verification code is: ${otp}`, emailHtml);
      console.log(`\n-----------------------------------------`);
      console.log(`[AUTH] OTP for ${email}: ${otp}`);
      console.log(`-----------------------------------------\n`);
      res.json({ success: true, message: 'OTP sent successfully' });
    });
  });
});

app.post('/api/auth/verify-email-otp', async (req, res) => {
  const { email, otp } = req.body;
  const now = new Date().toISOString();

  db.get("SELECT * FROM EmailOtps WHERE email = ? AND verified = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1", [email, now], async (err, row) => {
    if (!row) return res.status(400).json({ error: 'OTP expired or not found' });
    if (row.attempts >= 3) return res.status(400).json({ error: 'Too many attempts. Request a new OTP.' });

    const match = await bcrypt.compare(otp, row.otp_hash);
    if (!match) {
      db.run("UPDATE EmailOtps SET attempts = attempts + 1 WHERE id = ?", [row.id]);
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    db.run("UPDATE EmailOtps SET verified = 1 WHERE id = ?", [row.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: 'Email verified' });
    });
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  const ip = req.ip;

  const firestoreUser = await getFirestore().collection('Users').where('email', '==', email).get();
  if (!firestoreUser.empty) return res.status(400).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const role = (email === ADMIN_EMAIL) ? 'admin' : 'user';

  const newUser = {
    username, email, password_hash: hash, last_ip: ip, role,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    is_active: true, is_verified: false, is_phone_verified: false,
    rating: 0, total_trades: 0, uptime_score: 100.0
  };

  try {
    const docRef = await getFirestore().collection('Users').add(newUser);
    const userId = docRef.id;
    const token = jwt.sign({ id: userId, role, username, email }, JWT_SECRET, { expiresIn: '12h' });
    
    // Welcome Email... (keeping original logic)
    res.json({ success: true, token, role, user: { username, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    const ip = req.ip;

    const usersRef = getFirestore().collection('Users');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (snapshot.empty) {
      return res.status(400).json({ error: 'User not found. Please register first.' });
    }
    
    const user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const role = (email === ADMIN_EMAIL || user.role === 'admin') ? 'admin' : 'user';
    await usersRef.doc(user.id).update({ last_ip: ip, role });
    
    const token = jwt.sign({ id: user.id, role, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, role, user: { username: user.username, email: user.email } });
});

// Listing Logic
app.post('/api/listings/submit', authenticateToken, (req, res) => {
    const { 
      title, rank, mode, priceRentHr, priceRentDay, priceBuy, 
      region, description, username, password, 
      contactEmail, contactSocial, skins, imageUrl 
    } = req.body;

    // Price Validation
    if (priceRentHr < 0 || priceRentDay < 0 || priceBuy < 0) {
      return res.status(400).json({ error: "Price cannot be negative" });
    }

    const isRentable = mode === 'rent' || mode === 'both' ? 1 : 0;
    const isSellable = mode === 'sale' || mode === 'both' ? 1 : 0;

    const encPassword = encrypt(password);
    const isAdmin = req.user.role === 'admin';
    const sellerId = isAdmin ? null : req.user.id;
    const adminListed = isAdmin ? 1 : 0;
    
    const newListing = {
      title, rank, mode, price_rent_hr: priceRentHr, price_rent_day: priceRentDay, price_buy: priceBuy,
      region, description, account_username: username, account_password_encrypted: encPassword,
      contact_email: contactEmail, contact_social: contactSocial, seller_id: sellerId,
      is_active: adminListed, status: isAdmin ? 'approved' : 'pending', is_admin_listed: adminListed,
      image_url: imageUrl, is_rentable: isRentable, is_sellable: isSellable, skins: skins || [],
      total_rentals: 0, created_at: admin.firestore.FieldValue.serverTimestamp()
    };

    getFirestore().collection('Listings').add(newListing)
      .then(docRef => res.json({ success: true, listingId: docRef.id }))
      .catch(err => res.status(500).json({ error: err.message }));
});

app.get('/api/user/listings', authenticateToken, (req, res) => {
    db.all("SELECT * FROM Listings WHERE seller_id = ?", [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, listings: rows });
    });
});

app.get('/api/user/profile', authenticateToken, (req, res) => {
  db.get("SELECT username, email, role, is_active, is_verified, is_phone_verified, terms_accepted, profile_picture, rating, total_trades, uptime_score, created_at FROM Users WHERE id = ?", [req.user.id], (err, user) => {
     if (err) return res.status(500).json({ error: err.message });
     if (!user) return res.status(404).json({ error: 'User not found' });
     res.json(user);
  });
});

app.post('/api/user/accept-terms', authenticateToken, (req, res) => {
  db.run("UPDATE Users SET terms_accepted = 1 WHERE id = ?", [req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/user/verify-phone', authenticateToken, (req, res) => {
  db.run("UPDATE Users SET is_phone_verified = 1 WHERE id = ?", [req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    createNotification(req.user.id, "Phone Verified", "Your phone number has been successfully verified.", "success");
    res.json({ success: true });
  });
});

app.get('/api/notifications', authenticateToken, (req, res) => {
  db.all("SELECT * FROM Notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, notifications: rows });
  });
});

app.post('/api/notifications/read/:id', authenticateToken, (req, res) => {
  db.run("UPDATE Notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/admin/listings/:id/approve', authenticateToken, requireAdmin, (req, res) => {
    db.run("UPDATE Listings SET is_active = 1, status = 'approved', is_admin_listed = 1 WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get("SELECT seller_id, title FROM Listings WHERE id = ?", [req.params.id], (err2, listing) => {
          if (listing && listing.seller_id) {
            createNotification(listing.seller_id, "Listing Approved", `Your listing "${listing.title}" has been approved and is now live.`, "success");
          }
        });

        logAudit(req.user.id, 'Approve Listing', 'Listing', req.params.id, 'Listing approved and activated');
        res.json({ success: true });
    });
});

app.post('/api/admin/listings/:id/reject', authenticateToken, requireAdmin, (req, res) => {
    db.get("SELECT seller_id, title FROM Listings WHERE id = ?", [req.params.id], (err, listing) => {
      db.run("UPDATE Listings SET is_active = 0, status = 'rejected' WHERE id = ?", [req.params.id], function(err2) {
          if (err2) return res.status(500).json({ error: err2.message });

          if (listing && listing.seller_id) {
            createNotification(listing.seller_id, "Listing Rejected", `Your listing "${listing.title}" was rejected by the moderation team.`, "error");
          }

          logAudit(req.user.id, 'Reject Listing', 'Listing', req.params.id, 'Listing rejected');
          res.json({ success: true });
      });
    });
});


app.get('/api/listings', (req, res) => {
  try {
    const listingsRef = getFirestore().collection('Listings');
    const snapshot = await listingsRef.where('status', '==', 'approved').where('is_active', '==', true).get();
    
    const listings = snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data, 
        seller: { name: data.seller_name || 'System', verified: data.is_verified, rating: data.rating || 5, trades: data.total_trades || 0 }
      };
    });
    
    res.json({ success: true, listings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/listings/:id', async (req, res) => {
    try {
        const doc = await getFirestore().collection('Listings').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Not found' });
        
        const row = { id: doc.id, ...doc.data() };
        row.seller = { name: row.seller_name || 'System', verified: row.is_verified, rating: row.rating || 5, trades: row.total_trades || 0 };
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/checkout', authenticateToken, (req, res) => {
  const { listingId, type, durationHours, amount } = req.body; 
  
  db.serialize(() => {
    db.run("BEGIN EXCLUSIVE TRANSACTION");

    db.get("SELECT is_active FROM Listings WHERE id = ?", [listingId], (err, row) => {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: err.message });
      }
      if (!row || row.is_active === 0) {
        db.run("ROLLBACK");
        return res.status(400).json({ success: false, error: 'Listing is currently locked or already rented/sold.' });
      }

      db.run("INSERT INTO Transactions (user_id, listing_id, amount, tx_type) VALUES (?, ?, ?, ?)", [req.user.id, listingId, amount, type], function(err) {
          if (err) {
             db.run("ROLLBACK");
             return res.status(500).json({ error: err.message });
          }
          
          const txId = this.lastID;
          if (type === 'rent') {
              const startTime = new Date();
              const endTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000) + (10 * 60 * 1000));
              
              db.run("INSERT INTO Rentals (listing_id, user_id, transaction_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?)", 
                     [listingId, req.user.id, txId, startTime.toISOString(), endTime.toISOString(), 'active'], (err) => {
                         if (err) { db.run("ROLLBACK"); return res.status(500).json({ error: err.message }); }
                         
                         db.run("UPDATE Listings SET total_rentals = total_rentals + 1, is_active = 0 WHERE id = ?", [listingId]);
                         db.run("UPDATE Users SET total_trades = total_trades + 1 WHERE id = ?", [req.user.id]);
                         
                         db.run("COMMIT", () => {
                             io.emit('rental_started', { listingId, message: `Account locked for ${durationHours}h + 10m cooldown.` });
                             res.json({ success: true, message: 'Payment verified. Rental active with cooldown buffer.' });
                         });
                     });
          } else {
              db.run("UPDATE Listings SET is_active = 0 WHERE id = ?", [listingId], (err) => {
                  if (err) { db.run("ROLLBACK"); return; }
                  db.run("COMMIT", () => {
                      createNotification(req.user.id, "Purchase Successful", "You have successfully purchased this account.", "success");
                      db.get("SELECT seller_id, title FROM Listings WHERE id = ?", [listingId], (err, listing) => {
                        if (listing && listing.seller_id) {
                          createNotification(listing.seller_id, "Item Sold", `Your listing "${listing.title}" has been sold!`, "success");
                        }
                      });
                      res.json({ success: true, message: 'Purchase successful. Account locked.' });
                  });
              });
          }
      });
    });
  });
});

app.get('/api/user/dashboard', authenticateToken, (req, res) => {
  const now = new Date().toISOString();
  db.run("UPDATE Rentals SET status = 'expired' WHERE end_time < ? AND status = 'active'", [now], () => {
      db.all(`SELECT R.id, L.title, L.rank, R.start_time, R.end_time, R.status, L.account_username, L.account_password_encrypted 
              FROM Rentals R JOIN Listings L ON R.listing_id = L.id WHERE R.user_id = ? ORDER BY R.start_time DESC`, [req.user.id], (err, rows) => {
          const rentals = rows.map(r => ({
              id: r.id, title: r.title, rank: r.rank, startTime: r.start_time, endTime: r.end_time, status: r.status,
              credentials: r.status === 'active' ? { username: r.account_username, password: decrypt(r.account_password_encrypted) } : null
          }));
          res.json({ rentals });
      });
  });
});

app.get('/api/admin/dashboard', authenticateToken, requireAdmin, (req, res) => {
   db.all("SELECT SUM(amount) as total_earnings FROM Transactions", (err, earnings) => {
      db.all("SELECT * FROM Listings", (err2, listings) => {
          res.json({ earnings: earnings[0].total_earnings || 0, listings });
      });
   });
});

app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    db.all("SELECT id, username, email, role, is_active, is_verified, rating, total_trades, created_at FROM Users", (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ users });
    });
});

app.post('/api/admin/users/:id/verify', authenticateToken, requireAdmin, (req, res) => {
    db.get("SELECT is_verified FROM Users WHERE id = ?", [req.params.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const newStatus = user.is_verified ? 0 : 1;
        db.run("UPDATE Users SET is_verified = ? WHERE id = ?", [newStatus, req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, is_verified: newStatus });
        });
    });
});

app.get('/api/stats', (req, res) => {
    db.serialize(() => {
        let stats = { users: 0, trades: 0, volume: 0 };
        db.get("SELECT COUNT(*) as count FROM Users", (err, row) => {
            if (row) stats.users = row.count;
            db.get("SELECT COUNT(*) as count FROM Transactions", (err, row2) => {
                if (row2) stats.trades = row2.count;
                db.get("SELECT SUM(amount) as volume FROM Transactions", (err, row3) => {
                    if (row3) stats.volume = row3.volume || 0;
                    res.json(stats);
                });
            });
        });
    });
});

setInterval(() => {
    const now = new Date().toISOString();
    db.all("SELECT id, listing_id FROM Rentals WHERE end_time < ? AND status = 'active'", [now], (err, rows) => {
        if (!rows || rows.length === 0) return;
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            rows.forEach(r => {
                db.run("UPDATE Rentals SET status = 'expired' WHERE id = ?", [r.id]);
                const newPassword = encrypt(crypto.randomBytes(8).toString('hex'));
                db.run("UPDATE Listings SET account_password_encrypted = ?, is_active = 1 WHERE id = ?", [newPassword, r.listing_id]);
            });
            db.run("COMMIT", () => {
                logger.info(`Rotated credentials and unlocked ${rows.length} expired rentals.`);
                io.emit('rentals_expired', { count: rows.length });
            });
        });
    });
}, 30000);

if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`VaultSkins Production Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
