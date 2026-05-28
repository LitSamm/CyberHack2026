const express = require('express');
const router = express.Router();

// POST /api/seed — trigger seeder (dev only)
router.post('/', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Seed not allowed in production' });
  }
  try {
    // Run seed in background
    require('../db/seed');
    res.json({ message: 'Seed started. Check server logs for progress.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
