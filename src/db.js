const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wyf';

function connect() {
  return mongoose.connect(MONGO_URI, {
    autoIndex: true
  }
);
}

module.exports = { connect };
