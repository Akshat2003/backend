const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

async function resetPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find and update OP002 password
    const user = await User.findOne({ operatorId: 'OP002' });
    
    if (!user) {
      console.log('User OP002 not found');
      process.exit(1);
    }

    console.log('Found user:', user.operatorId, user.email);
    
    // Hash new password
    const hashedPassword = await bcrypt.hash('password123', 12);
    user.password = hashedPassword;
    user.status = 'active';
    await user.save();
    
    console.log('Password reset successfully for OP002');

    process.exit(0);

  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

resetPassword();