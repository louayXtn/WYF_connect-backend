// const express = require('express');
// const User = require('../models/user');

// const router = express.Router();

// router.post('/', async (req, res) => {
//   try {
//     const { name, email } = req.body;
//     if (!name) return res.status(400).json({ error: 'name is required' });
//     const user = await User.create({ name, email });
//     res.json(user);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.get('/', async (req, res) => {
//   try {
//     const users = await User.find().limit(100);
//     res.json(users);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;

const express = require('express');
const { User } = require('../models/user');
const auth = require('../middleware/auth');

const router = express.Router();

// عرض بروفايلي الحالي
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// تعديل بروفايلي
router.put('/me', auth, async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, nationality, countryOfResidence, investorProfile } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (nationality) user.nationality = nationality;
    if (countryOfResidence) user.countryOfResidence = countryOfResidence;
    if (investorProfile && user.role === 'investor') {
      user.investorProfile = { ...user.investorProfile, ...investorProfile };
    }

    await user.save();

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'EjfhlhrUNJbRU651KL5bDyvh54VytV8GGHJKLSSUYRUDNVVv5djjl9';

// يرجع توكن جديد فيه بيانات محدثة (يُستخدم بعد تعديل البروفايل)
router.post('/refresh-token', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });

    const token = jwt.sign(
      { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;