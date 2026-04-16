import app from '../server/index.js';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';

export default (req, res) => {
  // Step 2: Debug Route
  if (req.url === '/api/debug' || req.url === '/debug') {
    return res.status(200).json({ status: "API WORKING", timestamp: new Date().toISOString() });
  }

  if (!app) {
    return res.status(500).json({
      success: false,
      error: "Server logic failed to load. Check Vercel logs.",
      details: "Top-level import of server/index.js failed."
    });
  }

  try {
    return app(req, res);
  } catch (err) {
    console.error('Serverless Function Crash:', err);
    res.status(500).json({ 
      success: false, 
      error: "Internal Server Error", 
      details: err.message 
    });
  }
};
