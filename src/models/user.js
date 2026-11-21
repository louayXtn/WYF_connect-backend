// const { Schema, model } = require('mongoose');

// const UserSchema = new Schema({
//   name: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now }
// });

// module.exports = model('User', UserSchema);
const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
  firstName: { 
    type: String, 
    required: [true, 'First name is required'], 
    trim: true 
  },
  lastName: { 
    type: String, 
    required: [true, 'Last name is required'], 
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'], 
    minlength: 6,
    select: false
  },
  nationality: { 
    type: String, 
    required: [true, 'Nationality is required'] 
  },
  countryOfResidence: { 
    type: String, 
    required: [true, 'Country of residence is required'] 
  },
  phoneNumber: { 
    type: String, 
    trim: true 
  },
  role: { 
    type: String, 
    enum: ['youth', 'investor', 'admin'], 
    required: [true, 'Account type is required'] 
  },
  investorProfile: {
    entityName: { type: String },
    targetIndustries: [{ type: String }]
  },
  isTermsAccepted: { 
    type: Boolean, 
    required: [true, 'You must accept the terms and conditions'],
    default: false
  },
verification: {
status: {
type: String,
enum: ['unverified', 'pending', 'verified', 'rejected'],
default: 'unverified'
    },
idCardFrontUrl: { type: String },
idCardBackUrl: { type: String },
selfieWithIdUrl: { type: String },
rejectionReason: { type: String },
submittedAt: { type: Date },
verifiedAt: { type: Date }
  },
resetPasswordToken: { type: String, select: false },
resetPasswordExpires: { type: Date, select: false }
}, 
{
timestamps: true
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = { User: model('User', userSchema) };