const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function listUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find({}, 'operatorId email phoneNumber role status');
    
    console.log('Found users:');
    users.forEach(user => {
      console.log(`- ${user.operatorId}: ${user.email} (${user.role}) - ${user.status}`);
    });

    process.exit(0);

  } catch (error) {
    console.error('Error listing users:', error);
    process.exit(1);
  }
}

listUsers();