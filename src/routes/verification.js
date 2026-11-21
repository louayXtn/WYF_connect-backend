const express = require('express');
const { User } = require('../models/user');
const auth = require('../middleware/auth');

const router = express.Router();
const notify = require('../utils/notify');
// المستخدم يرفع طلب توثيق هوية
router.post('/submit', auth, async (req, res) => {
  try {
    const { idCardFrontUrl, idCardBackUrl, selfieWithIdUrl, phoneNumber } = req.body;

    if (!idCardFrontUrl || !idCardBackUrl || !selfieWithIdUrl || !phoneNumber) {
      return res.status(400).json({ error: 'all verification fields are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });

    user.phoneNumber = phoneNumber; // يحدث رقم الهاتف الأساسي بالبروفايل

    user.verification = {
      status: 'pending',
      idCardFrontUrl,
      idCardBackUrl,
      selfieWithIdUrl,
      submittedAt: new Date(),
      rejectionReason: undefined,
      verifiedAt: undefined
    };

    await user.save();

    res.json({ message: 'Verification request submitted', verification: user.verification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// المستخدم يشوف حالة التوثيق تبعه
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'user not found' });
    res.json(user.verification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin routes ---

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'admin access required' });
  }
  next();
}

// الإدمن يشوف كل طلبات التوثيق المعلقة
router.get('/pending', auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({ 'verification.status': 'pending' }).select(
      'firstName lastName email phoneNumber verification'
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// الإدمن يوافق على طلب توثيق
router.post('/:userId/approve', auth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user not found' });

    user.verification.status = 'verified';
    user.verification.verifiedAt = new Date();
    user.verification.rejectionReason = undefined;
    await user.save();

    await notify(user._id, 'Identity Verified ✓', 'Your identity has been verified. You now have a verified badge.', '/dashboard/profile');

    res.json({ message: 'User verified successfully', verification: user.verification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// الإدمن يرفض طلب توثيق
router.post('/:userId/reject', auth, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'user not found' });

    user.verification.status = 'rejected';
    user.verification.rejectionReason = reason || 'Not specified';
    await user.save();

    await notify(user._id, 'Verification Declined', `Your identity verification was declined: ${user.verification.rejectionReason}`, '/dashboard/verify-identity');

    res.json({ message: 'Verification rejected', verification: user.verification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
