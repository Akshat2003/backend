const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function resetUserAuth() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sparkee-parking');
    console.log('Connected to MongoDB');

    // Reset all users' authentication attempts and lockouts
    const result = await User.updateMany(
      {},
      {
        $unset: {
          loginAttempts: 1,
          lockUntil: 1
        }
      }
    );

    console.log(`Reset authentication for ${result.modifiedCount} users`);
    console.log('All user accounts are now unlocked and login attempts reset');

    // Also list admin users for reference
    const adminUsers = await User.find({ role: 'admin' }).select('operatorId name email role');
    console.log('\nAdmin users in system:');
    adminUsers.forEach(user => {
      console.log(`- ${user.operatorId} (${user.name}) - ${user.email}`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error resetting user authentication:', error);
    process.exit(1);
  }
}

resetUserAuth();