const app = require('../server/index.js');

module.exports = (req, res) => {
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
