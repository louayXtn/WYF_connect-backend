const { Schema, model, Types } = require('mongoose');

const NdaRequestSchema = new Schema(
  {
    project: { type: Types.ObjectId, ref: 'Project', required: true },
    requester: { type: Types.ObjectId, ref: 'User', required: true }, // المستثمر
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    respondedAt: { type: Date }
  },
  { timestamps: true }
);

// ما يقدر نفس المستثمر يطلب NDA أكتر من مرة على نفس المشروع
NdaRequestSchema.index({ project: 1, requester: 1 }, { unique: true });

module.exports = model('NdaRequest', NdaRequestSchema);