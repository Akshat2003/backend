const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

const updates = [
  { operatorId: 'OP101', password: 'Spark@anajmarket' },
  { operatorId: 'OP102', password: 'Spark@sitabuldi' },
];

async function resetPasswords() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  for (const { operatorId, password } of updates) {
    const hash = await bcrypt.hash(password, 12);
    const result = await User.updateOne(
      { operatorId },
      { $set: { password: hash, passwordChangedAt: new Date(), loginAttempts: 0, lockUntil: null } }
    );
    if (result.matchedCount === 0) {
      console.log(operatorId + ': NOT FOUND');
    } else {
      console.log(operatorId + ': password updated successfully');
    }
  }

  process.exit(0);
}

resetPasswords().catch(err => { console.error(err); process.exit(1); });
