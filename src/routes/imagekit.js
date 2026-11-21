const express = require('express');
const imagekit = require('../utils/imagekit');
const auth = require('../middleware/auth');

const router = express.Router();

// لازم يكون مسجل دخول عشان ياخد توكن رفع
router.get('/auth', auth, (req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    res.json(authParams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
