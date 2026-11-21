const Notification = require('../models/notification');

async function notify(userId, title, body, link) {
  try {
    await Notification.create({ user: userId, title, body, link });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
}

module.exports = notify;