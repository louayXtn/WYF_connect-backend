const { Schema, model, Types } = require('mongoose');

const CommentSchema = new Schema({
  author: { type: Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

const ProjectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    images: { type: [String], default: [] },
    category: {
      type: String,
      enum: [
        'Technology',
        'Agriculture',
        'Fintech',
        'Health',
        'Education',
        'E-commerce',
        'Sustainability',
        'Other'
      ],
      default: 'Other'
    },
    goalAmount: { type: Number, required: true, min: 1 },
    totalCost: { type: Number, required: true, min: 1 },
    fundedAmount: { type: Number, default: 0 },
    owner: { type: Types.ObjectId, ref: 'User', required: true },
    investorsCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['active', 'funded', 'closed'],
      default: 'active'
    },
    comments: { type: [CommentSchema], default: [] },
    confidentialInfo: {
      financialPlanUrl: { type: String },
      technicalDetailsUrl: { type: String },
      additionalNotes: { type: String, trim: true }
    }
  },
  { timestamps: true }
);

module.exports = model('Project', ProjectSchema);