const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

async function fixTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check existing user
    let user = await User.findOne({ operatorId: 'OP001' });
    
    if (!user) {
      console.log('No user found with OP001. Creating new user...');
      
      // Hash password
      const hashedPassword = await bcrypt.hash('password123', 12);

      // Create test user
      user = new User({
        operatorId: 'OP001',
        firstName: 'Test',
        lastName: 'Operator',
        email: 'testop001@example.com',
        phoneNumber: '9876543210',
        password: hashedPassword,
        role: 'operator',
        status: 'active'
      });

      await user.save();
      console.log('Test user created successfully:', user.operatorId);
    } else {
      console.log('User found:', user.operatorId, user.email);
      
      // Update password
      const hashedPassword = await bcrypt.hash('password123', 12);
      user.password = hashedPassword;
      user.status = 'active';
      await user.save();
      
      console.log('User password updated successfully');
    }

    process.exit(0);

  } catch (error) {
    console.error('Error fixing test user:', error);
    process.exit(1);
  }
}

fixTestUser();