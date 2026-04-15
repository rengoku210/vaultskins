const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'marketplace.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    // Enable foreign keys
    db.run("PRAGMA foreign_keys = ON;");

    // Initialize Schema
    db.serialize(() => {
      // 1. Users Table
      db.run(`CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        role TEXT DEFAULT 'user',
        firebase_uid TEXT UNIQUE,
        profile_picture TEXT,
        last_ip TEXT,
        is_active BOOLEAN DEFAULT 1,
        is_verified BOOLEAN DEFAULT 0,
        is_phone_verified BOOLEAN DEFAULT 0,
        rating REAL DEFAULT 0,
        total_trades INTEGER DEFAULT 0,
        uptime_score REAL DEFAULT 100.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 2. Listings Table
      db.run(`CREATE TABLE IF NOT EXISTS Listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER,
        is_admin_listed BOOLEAN DEFAULT 0,
        title TEXT NOT NULL,
        rank TEXT NOT NULL,
        mode TEXT NOT NULL CHECK(mode IN ('rent', 'sale', 'both')),
        price_rent_hr REAL,
        price_rent_day REAL,
        price_buy REAL,
        region TEXT NOT NULL,
        description TEXT,
        account_username TEXT NOT NULL,
        account_password_encrypted TEXT NOT NULL,
        contact_email TEXT,
        contact_social TEXT,
        is_active BOOLEAN DEFAULT 1,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'expired')),
        total_rentals INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(seller_id) REFERENCES Users(id)
      )`);

      // 3. ListingSkins Table (Many-to-many relationship mapping)
      db.run(`CREATE TABLE IF NOT EXISTS ListingSkins (
        listing_id INTEGER NOT NULL,
        skin_name TEXT NOT NULL,
        FOREIGN KEY(listing_id) REFERENCES Listings(id) ON DELETE CASCADE
      )`);

      // 4. Transactions Table
      db.run(`CREATE TABLE IF NOT EXISTS Transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        listing_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        tx_type TEXT CHECK(tx_type IN ('rent', 'buy')),
        status TEXT DEFAULT 'completed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES Users(id),
        FOREIGN KEY(listing_id) REFERENCES Listings(id)
      )`);

      // 5. Rentals Table
      db.run(`CREATE TABLE IF NOT EXISTS Rentals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        transaction_id INTEGER NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY(listing_id) REFERENCES Listings(id),
        FOREIGN KEY(user_id) REFERENCES Users(id)
      )`);

      // 6. Coupons Table
      db.run(`CREATE TABLE IF NOT EXISTS Coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_pct REAL NOT NULL,
        max_uses INTEGER DEFAULT 100,
        uses INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1
      )`);

      // 7. Reviews Table
      db.run(`CREATE TABLE IF NOT EXISTS Reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id INTEGER NOT NULL,
        reviewer_id INTEGER NOT NULL,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(listing_id) REFERENCES Listings(id),
        FOREIGN KEY(reviewer_id) REFERENCES Users(id)
      )`);

      // 8. LoginAttempts Table (Anti-Abuse)
      db.run(`CREATE TABLE IF NOT EXISTS LoginAttempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT,
        username_attempted TEXT,
        success BOOLEAN,
        attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 9. AuditLogs Table (Monitoring & Logs)
      db.run(`CREATE TABLE IF NOT EXISTS AuditLogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(admin_id) REFERENCES Users(id)
      )`);

      // 10. Notifications Table
      db.run(`CREATE TABLE IF NOT EXISTS Notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'error')),
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES Users(id)
      )`);

      // 11. Email OTPs Table
      db.run(`CREATE TABLE IF NOT EXISTS EmailOtps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        expires_at DATETIME NOT NULL,
        verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    });
  }
});

module.exports = db;
