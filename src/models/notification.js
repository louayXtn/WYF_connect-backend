const { Schema, model, Types } = require('mongoose');

const NotificationSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String }, // رابط اختياري يودي المستخدم للصفحة ذات الصلة
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = model('Notification', NotificationSchema);