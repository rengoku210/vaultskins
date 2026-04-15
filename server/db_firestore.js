const admin = require('firebase-admin');

// Service account should be provided via environment variable VERCEL_FIREBASE_SERVICE_ACCOUNT
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      });
    }
  } catch (e) {
    console.warn("Firebase Admin failed with service account, trying default.");
  }
}

if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// Helper to mimic SQLite methods
const db = {
  get: async (table, id) => {
    const doc = await firestore.collection(table).doc(id.toString()).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  
  query: async (table, filters = []) => {
    let q = firestore.collection(table);
    filters.forEach(f => {
      q = q.where(f.field, f.op, f.value);
    });
    const snapshot = await q.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  run: async (table, data, id = null) => {
    if (id) {
      await firestore.collection(table).doc(id.toString()).set(data, { merge: true });
      return id;
    } else {
      const docRef = await firestore.collection(table).add({
        ...data,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });
      return docRef.id;
    }
  },

  // Fallback for custom logic in index.js
  firestore: () => firestore
};

module.exports = db;
