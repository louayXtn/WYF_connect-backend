const { Schema, model, Types } = require('mongoose');

const ApplicationSchema = new Schema(
  {
    applicant: { type: Types.ObjectId, ref: 'User', required: true },
    project: { type: Types.ObjectId, ref: 'Project', required: true },
    message: { type: String, trim: true },
    pitchDeckUrl: { type: String },
    financialModelUrl: { type: String },
    pitchVideoUrl: { type: String },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

const OpportunitySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    entityName: { type: String, trim: true },
    type: {
      type: String,
      enum: ['equity', 'grant', 'pre_seed', 'incubation'],
      required: true
    },
    description: { type: String, required: true },
    fundingMin: { type: Number, required: true, min: 0 },
    fundingMax: { type: Number, required: true, min: 0 },
    targetStage: {
      type: String,
      enum: ['idea', 'mvp', 'startup'],
      required: true
    },
    targetIndustries: [{ type: String }],
    geographicScope: [{ type: String }], // فارغة = دولي
    requiredDocuments: {
      pitchDeck: { type: Boolean, default: false },
      financialModel: { type: Boolean, default: false },
      pitchVideo: { type: Boolean, default: false }
    },
    deadline: { type: Date },
    postedBy: { type: Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['open', 'under_review', 'closed'],
      default: 'open'
    },
    applications: { type: [ApplicationSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = model('Opportunity', OpportunitySchema);