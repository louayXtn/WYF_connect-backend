// const express = require('express');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const User = require('../models/user');

// const router = express.Router();

// const JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_a_strong_secret';

// router.post('/register', async (req, res) => {
//   try {
//     const { name, email, password } = req.body;
//     if (!name || !email || !password) return res.status(400).json({ error: 'missing fields' });
//     const exists = await User.findOne({ email });
//     if (exists) return res.status(400).json({ error: 'email already in use' });
//     const hash = await bcrypt.hash(password, 10);
//     const user = await User.create({ name, email, password: hash });
//     const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
//     res.json({ user: { id: user._id, name: user.name, email: user.email }, token });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.post('/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) return res.status(400).json({ error: 'missing fields' });
//     const user = await User.findOne({ email });
//     if (!user) return res.status(400).json({ error: 'invalid credentials' });
//     const ok = await bcrypt.compare(password, user.password);
//     if (!ok) return res.status(400).json({ error: 'invalid credentials' });
//     const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
//     res.json({ user: { id: user._id, name: user.name, email: user.email }, token });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;


const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models/user');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_a_strong_secret';

router.post('/register', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      nationality,
      countryOfResidence,
      phoneNumber,
      role,
      isTermsAccepted,
      investorProfile
    } = req.body;

    if (!firstName || !lastName || !email || !password || !nationality || !countryOfResidence || !role) {
      return res.status(400).json({ error: 'missing fields' });
    }

    if (!isTermsAccepted) {
      return res.status(400).json({ error: 'you must accept the terms and conditions' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'email already in use' });

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      nationality,
      countryOfResidence,
      phoneNumber,
      role,
      isTermsAccepted,
      investorProfile
    });

    const token = jwt.sign(
      { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'missing fields' });

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ error: 'invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(400).json({ error: 'invalid credentials' });

    const token = jwt.sign(
      { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const crypto = require('crypto');
const { sendResetPasswordEmail } = require('../utils/email');

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'If this email exists, a reset link has been sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 30 * 60 * 1000;
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
    await sendResetPasswordEmail(user.email, resetLink);

    res.json({ message: 'If this email exists, a reset link has been sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'missing fields' });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ error: 'invalid or expired reset token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;