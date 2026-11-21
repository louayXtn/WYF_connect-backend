const jwt = require('jsonwebtoken');
const { User } = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_to_a_strong_secret';

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireVerified(req, res, next) {
  User.findById(req.user.id)
    .then((user) => {
      if (!user || user.verification?.status !== 'verified') {
        return res.status(403).json({ error: 'You must verify your identity before investing' });
      }
      next();
    })
    .catch((err) => res.status(500).json({ error: err.message }));
}

module.exports = auth;
module.exports.requireVerified = requireVerified;