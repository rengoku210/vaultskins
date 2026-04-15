const sqlite3 = require('sqlite3').verbose();
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
// Assuming you have the service account JSON or are in a GCP environment.
// For local migration, you might need to point to a service account file.
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
} else {
  // Try default initialization
  try {
    admin.initializeApp();
  } catch (e) {
    console.warn("Firebase Admin failed to initialize. Please set FIREBASE_SERVICE_ACCOUNT env var.");
    process.exit(1);
  }
}

const db = admin.firestore();
const sqliteDbPath = path.join(__dirname, 'marketplace.db');
const sqliteDb = new sqlite3.Database(sqliteDbPath);

async function migrate() {
  console.log("Starting migration...");

  // Migrate Users (excluding password hashes for security if you prefer Firebase Auth, but let's keep them for now)
  sqliteDb.all("SELECT * FROM Users", [], async (err, rows) => {
    if (err) return console.error(err);
    for (const row of rows) {
      await db.collection('Users').doc(row.id.toString()).set(row);
      console.log(`Migrated user: ${row.username}`);
    }
  });

  // Migrate Listings
  sqliteDb.all("SELECT * FROM Listings", [], async (err, rows) => {
    if (err) return console.error(err);
    for (const row of rows) {
      const { id, ...listingData } = row;
      // Get skins for this listing
      sqliteDb.all("SELECT skin_name FROM ListingSkins WHERE listing_id = ?", [id], async (err, skins) => {
        const skinNames = skins.map(s => s.skin_name);
        await db.collection('Listings').doc(id.toString()).set({
          ...listingData,
          skins: skinNames
        });
        console.log(`Migrated listing: ${row.title}`);
      });
    }
  });

  // Migrate Stats/Transactions/etc if needed
  // ...
}

migrate();
