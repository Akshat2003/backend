const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

async function resetOP102Password() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find and update OP102 password
    const user = await User.findOne({ operatorId: 'OP102' });
    
    if (!user) {
      console.log('User OP102 not found');
      process.exit(1);
    }

    console.log('Found user:', user.operatorId, user.email);
    
    // Hash new password
    const hashedPassword = await bcrypt.hash('sita123', 12);
    user.password = hashedPassword;
    user.status = 'active';
    user.passwordChangedAt = new Date();
    await user.save();
    
    console.log('✅ Password reset successfully for OP102');
    console.log('   - Operator ID: OP102');
    console.log('   - Email: sitaop@sparkee.com');
    console.log('   - Password: sita123');

    process.exit(0);

  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

resetOP102Password();