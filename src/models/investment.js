const { Schema, model, Types } = require('mongoose');

const InvestmentSchema = new Schema(
  {
    project: { type: Types.ObjectId, ref: 'Project', required: true },
    investor: { type: Types.ObjectId, ref: 'User', required: false },
    investorName: { type: String, trim: true },
    amount: { type: Number, required: true, min: 1 },
    note: { type: String, trim: true },
    source: {
      type: String,
      enum: ['platform', 'external'],
      default: 'platform'
    },
    status: {
      type: String,
      enum: ['confirmed', 'pending', 'rejected'],
      default: 'confirmed'
    },
    proofUrl: { type: String }, // رابط صورة إثبات (تحويل بنكي، سكرين شوت، إلخ) — للمساهمات الخارجية أو غير الموثقة
    addedBy: { type: Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = model('Investment', InvestmentSchema);