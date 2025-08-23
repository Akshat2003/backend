const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 12);

    // Create test user
    const testUser = new User({
      operatorId: 'OP001',
      firstName: 'Test',
      lastName: 'Operator',
      email: 'test@example.com',
      phoneNumber: '9876543210',
      password: hashedPassword,
      role: 'operator',
      status: 'active'
    });

    await testUser.save();
    console.log('Test user created successfully:', testUser.operatorId);

    process.exit(0);

  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();