const express = require('express');
const Investment = require('../models/investment');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const items = await Investment.find().sort({ createdAt: -1 }).limit(200).populate('project');
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
