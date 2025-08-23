const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.operatorId);
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Create admin user
    const adminUser = new User({
      operatorId: 'OP999',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@sparkee.com',
      phoneNumber: '9999999999',
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      department: 'Administration',
      shift: 'morning',
      permissions: [
        'create_booking',
        'update_booking', 
        'cancel_booking',
        'view_analytics',
        'manage_customers',
        'manage_machines',
        'view_reports',
        'manage_operators'
      ]
    });

    await adminUser.save();
    
    console.log('✅ Admin user created successfully!');
    console.log('📋 Admin Details:');
    console.log('   - Operator ID: OP999');
    console.log('   - Email: admin@sparkee.com');
    console.log('   - Password: admin123');
    console.log('   - Role: admin');
    console.log('   - Status: active');
    console.log('\n🔐 Please change the password after first login for security.');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();