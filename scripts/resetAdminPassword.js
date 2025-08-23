const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

async function resetAdminPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find admin user
    const adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      console.log('❌ No admin user found');
      process.exit(1);
    }

    console.log('Found admin user:', adminUser.operatorId, adminUser.email);

    // Hash new password
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    // Update password
    adminUser.password = hashedPassword;
    adminUser.status = 'active';
    await adminUser.save();

    console.log('✅ Admin password reset successfully!');
    console.log('📋 Admin Login Credentials:');
    console.log('   - Operator ID:', adminUser.operatorId);
    console.log('   - Email:', adminUser.email);
    console.log('   - Password: admin123');
    console.log('   - Role:', adminUser.role);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error resetting admin password:', error);
    process.exit(1);
  }
}

resetAdminPassword();