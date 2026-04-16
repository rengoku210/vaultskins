import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import http from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import winston from 'winston';
import { z } from 'zod';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
// Removed SQLite
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

// ── Initialize Firebase Admin Safely ──
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    if (raw.startsWith('{')) {
      serviceAccount = JSON.parse(raw);
      logger.info("Found valid-looking JSON in FIREBASE_SERVICE_ACCOUNT.");
    } else if (raw.includes('require') || raw.includes('var ')) {
      logger.error("❌ CRITICAL: FIREBASE_SERVICE_ACCOUNT contains JavaScript code, not JSON. Please provide the JSON format from the Firebase Console.");
    } else {
      logger.error("❌ CRITICAL: FIREBASE_SERVICE_ACCOUNT is not in JSON format.");
    }
  }
} catch (err) {
  logger.error("❌ Firebase JSON parse failed. Ensure your Vercel environment variable is the raw JSON string.");
  console.error(err);
}

if (!admin.apps.length) {
  if (serviceAccount) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      logger.info("Firebase Admin initialized via cert.");
    } catch (e) {
      logger.error("❌ Firebase init with cert failed:", e.message);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    logger.info("Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS.");
  } else {
    logger.warn("⚠️ No Firebase credentials found. Backend running in restricted mode.");
  }
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

async function logAudit(adminId, action, targetType, targetId, details) {
  try {
    await getFirestore().collection('AuditLogs').add({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    io.emit('admin_activity', { action, targetType, time: new Date() });
  } catch (err) {
    logger.error('Audit Log Error:', err);
  }
}

async function createNotification(userId, title, message, type = 'info') {
  try {
    await getFirestore().collection('Notifications').add({
      user_id: userId,
      title,
      message,
      type,
      is_read: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    io.emit('new_notification', { userId, title, message, type });
  } catch (err) {
    logger.error(`Failed to create notification for user ${userId}: ${err.message}`);
  }
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

// ── Health Check ──
app.get('/api', (req, res) => {
  res.json({ 
    status: "API WORKING", 
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'production' : 'development',
    firebase_init: admin.apps.length > 0
  });
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

  try {
    const usersRef = getFirestore().collection('Users');
    const userSnapshot = await usersRef.where('email', '==', email).get();
    
    if (!userSnapshot.empty) return res.status(400).json({ error: 'Email already registered' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 60000));

    await getFirestore().collection('EmailOtps').add({
      email,
      otp_hash: otpHash,
      expires_at: expiresAt,
      verified: 0,
      attempts: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

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
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    logger.error('Request OTP Error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

app.post('/api/auth/verify-email-otp', async (req, res) => {
  const { email, otp } = req.body;
  
  try {
    const otpSnapshot = await getFirestore().collection('EmailOtps')
      .where('email', '==', email)
      .where('verified', '==', 0)
      .where('expires_at', '>', admin.firestore.Timestamp.now())
      .orderBy('expires_at', 'desc')
      .limit(1)
      .get();

    if (otpSnapshot.empty) return res.status(400).json({ error: 'OTP expired or not found' });
    
    const doc = otpSnapshot.docs[0];
    const row = doc.data();

    if (row.attempts >= 3) return res.status(400).json({ error: 'Too many attempts. Request a new OTP.' });

    const match = await bcrypt.compare(otp, row.otp_hash);
    if (!match) {
      await doc.ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    await doc.ref.update({ verified: 1 });
    res.json({ success: true, message: 'Email verified' });
  } catch (err) {
    logger.error('Verify OTP Error:', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
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

app.post('/api/auth/login', loginLimiter, async (req, res) => {
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

app.get('/api/user/listings', authenticateToken, async (req, res) => {
    try {
        const snapshot = await getFirestore().collection('Listings').where('seller_id', '==', req.user.id).get();
        const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json({ success: true, listings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const doc = await getFirestore().collection('Users').doc(req.user.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/accept-terms', authenticateToken, async (req, res) => {
  try {
    await getFirestore().collection('Users').doc(req.user.id).update({ terms_accepted: 1 });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/verify-phone', authenticateToken, async (req, res) => {
  try {
    await getFirestore().collection('Users').doc(req.user.id).update({ is_phone_verified: 1 });
    await createNotification(req.user.id, "Phone Verified", "Your phone number has been successfully verified.", "success");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const snapshot = await getFirestore().collection('Notifications')
      .where('user_id', '==', req.user.id)
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/notifications/read/:id', authenticateToken, async (req, res) => {
  try {
    await getFirestore().collection('Notifications').doc(req.params.id).update({ is_read: 1 });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/listings/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const listingRef = getFirestore().collection('Listings').doc(req.params.id);
        const doc = await listingRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Listing not found' });
        
        const listing = doc.data();
        await listingRef.update({ is_active: 1, status: 'approved', is_admin_listed: 1 });
        
        if (listing.seller_id) {
          await createNotification(listing.seller_id, "Listing Approved", `Your listing "${listing.title}" has been approved and is now live.`, "success");
        }

        await logAudit(req.user.id, 'Approve Listing', 'Listing', req.params.id, 'Listing approved and activated');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/listings/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const listingRef = getFirestore().collection('Listings').doc(req.params.id);
        const doc = await listingRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Listing not found' });
        
        const listing = doc.data();
        await listingRef.update({ is_active: 0, status: 'rejected' });
        
        if (listing.seller_id) {
          await createNotification(listing.seller_id, "Listing Rejected", `Your listing "${listing.title}" was rejected by the moderation team.`, "error");
        }

        await logAudit(req.user.id, 'Reject Listing', 'Listing', req.params.id, 'Listing rejected');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/listings', async (req, res) => {
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

app.post('/api/checkout', authenticateToken, async (req, res) => {
  const { listingId, type, durationHours, amount } = req.body; 
  
  try {
    const result = await getFirestore().runTransaction(async (transaction) => {
      const listingRef = getFirestore().collection('Listings').doc(listingId);
      const listingDoc = await transaction.get(listingRef);
      
      if (!listingDoc.exists || listingDoc.data().is_active === 0) {
        throw new Error('Listing is currently locked or already rented/sold.');
      }

      const txRef = getFirestore().collection('Transactions').doc();
      transaction.set(txRef, {
        user_id: req.user.id,
        listing_id: listingId,
        amount,
        tx_type: type,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      if (type === 'rent') {
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000) + (10 * 60 * 1000));
        
        const rentalRef = getFirestore().collection('Rentals').doc();
        transaction.set(rentalRef, {
          listing_id: listingId,
          user_id: req.user.id,
          transaction_id: txRef.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'active',
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        transaction.update(listingRef, { 
          total_rentals: admin.firestore.FieldValue.increment(1),
          is_active: 0 
        });
      } else {
        transaction.update(listingRef, { is_active: 0 });
      }

      const userRef = getFirestore().collection('Users').doc(req.user.id);
      transaction.update(userRef, { total_trades: admin.firestore.FieldValue.increment(1) });

      return { type, durationHours };
    });

    if (result.type === 'rent') {
      io.emit('rental_started', { listingId, message: `Account locked for ${result.durationHours}h + 10m cooldown.` });
      res.json({ success: true, message: 'Payment verified. Rental active with cooldown buffer.' });
    } else {
      await createNotification(req.user.id, "Purchase Successful", "You have successfully purchased this account.", "success");
      const listingDoc = await getFirestore().collection('Listings').doc(listingId).get();
      const listing = listingDoc.data();
      if (listing && listing.seller_id) {
        await createNotification(listing.seller_id, "Item Sold", `Your listing "${listing.title}" has been sold!`, "success");
      }
      res.json({ success: true, message: 'Purchase successful. Account locked.' });
    }
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/user/dashboard', authenticateToken, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const rentalsRef = getFirestore().collection('Rentals');
    const rentalsSnapshot = await rentalsRef.where('user_id', '==', req.user.id).orderBy('start_time', 'desc').get();
    
    const rentals = await Promise.all(rentalsSnapshot.docs.map(async (doc) => {
      const r = doc.data();
      let status = r.status;
      if (status === 'active' && r.end_time < now) {
        status = 'expired';
        await doc.ref.update({ status: 'expired' });
      }

      const listingDoc = await getFirestore().collection('Listings').doc(r.listing_id).get();
      const l = listingDoc.data() || {};

      return {
        id: doc.id,
        title: l.title || 'Unknown Listing',
        rank: l.rank || 'Unranked',
        startTime: r.start_time,
        endTime: r.end_time,
        status: status,
        credentials: status === 'active' ? { 
          username: l.account_username, 
          password: decrypt(l.account_password_encrypted) 
        } : null
      };
    }));

    res.json({ rentals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
   try {
     const transactionsSnapshot = await getFirestore().collection('Transactions').get();
     let earnings = 0;
     transactionsSnapshot.forEach(doc => { earnings += Number(doc.data().amount || 0); });
     
     const listingsSnapshot = await getFirestore().collection('Listings').get();
     const listings = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
     
     res.json({ earnings, listings });
   } catch (err) {
     res.status(500).json({ error: err.message });
   }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const snapshot = await getFirestore().collection('Users').get();
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/users/:id/verify', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userRef = getFirestore().collection('Users').doc(req.params.id);
        const doc = await userRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'User not found' });
        
        const newStatus = doc.data().is_verified ? 0 : 1;
        await userRef.update({ is_verified: newStatus });
        res.json({ success: true, is_verified: newStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats', async (req, res) => {
  try {
    const usersCount = (await getFirestore().collection('Users').count().get()).data().count;
    const transactionsSnapshot = await getFirestore().collection('Transactions').get();
    
    let trades = 0;
    let volume = 0;
    
    transactionsSnapshot.forEach(doc => {
      trades++;
      volume += Number(doc.data().amount || 0);
    });

    res.json({ users: usersCount, trades, volume });
  } catch (err) {
    logger.error('Stats Error:', err);
    res.json({ users: 0, trades: 0, volume: 0 }); // Fallback
  }
});

setInterval(async () => {
    try {
        const now = new Date().toISOString();
        const rentalsSnapshot = await getFirestore().collection('Rentals')
            .where('end_time', '<', now)
            .where('status', '==', 'active')
            .get();

        if (rentalsSnapshot.empty) return;

        for (const doc of rentalsSnapshot.docs) {
            const r = doc.data();
            await doc.ref.update({ status: 'expired' });
            
            const newPasswordRaw = crypto.randomBytes(8).toString('hex');
            const newPasswordEnc = encrypt(newPasswordRaw);
            
            await getFirestore().collection('Listings').doc(r.listing_id).update({
                account_password_encrypted: newPasswordEnc,
                is_active: 1
            });
        }
        
        logger.info(`Rotated credentials and unlocked ${rentalsSnapshot.size} expired rentals.`);
        io.emit('rentals_expired', { count: rentalsSnapshot.size });
    } catch (err) {
        logger.error('Credential Rotation Error:', err);
    }
}, 30000);

// Removed server.listen for Vercel compatibility
// Export the app for Vercel/Entry points
export default app;
