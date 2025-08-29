const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

async function resetOP101Password() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find and update OP101 password
    const user = await User.findOne({ operatorId: 'OP101' });
    
    if (!user) {
      console.log('User OP101 not found');
      process.exit(1);
    }

    console.log('Found user:', user.operatorId, user.email);
    
    // Hash new password
    const hashedPassword = await bcrypt.hash('anaj123', 12);
    user.password = hashedPassword;
    user.status = 'active';
    user.passwordChangedAt = new Date();
    await user.save();
    
    console.log('✅ Password reset successfully for OP101');
    console.log('   - Operator ID: OP101');
    console.log('   - Email: anajop@sparkee.com');
    console.log('   - Password: anaj123');

    process.exit(0);

  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  }
}

resetOP101Password();