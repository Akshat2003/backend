const mongoose = require('mongoose');
require('dotenv').config();

const Machine = require('../models/Machine');
const User = require('../models/User');

async function createM003Machine() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get a user to use as createdBy
    const user = await User.findOne({ operatorId: 'OP002' });
    if (!user) {
      console.error('No user found for createdBy field');
      process.exit(1);
    }

    // Check if machine already exists
    const existingM003 = await Machine.findOne({ machineNumber: 'M003' });

    if (!existingM003) {
      // Create new machine
      const machine3 = new Machine({
        machineNumber: 'M003',
        machineName: 'Test Parking Machine C',
        status: 'online',
        capacity: {
          total: 8,
          available: 8,
          occupied: 0,
          maintenance: 0
        },
        location: {
          building: 'Test Building',
          floor: 'Ground Floor',
          zone: 'Zone C',
          coordinates: {
            latitude: 12.9725,
            longitude: 77.5955
          }
        },
        specifications: {
          maxVehicleLength: 5000, // mm
          maxVehicleWidth: 2000, // mm  
          maxVehicleHeight: 2000, // mm
          maxVehicleWeight: 3000, // kg
          supportedVehicleTypes: ['two-wheeler', 'four-wheeler']
        },
        vendor: {
          name: 'Test Systems Pvt Ltd',
          contactPerson: 'Test Contact',
          phoneNumber: '9876543210',
          email: 'contact@testsys.com'
        },
        warrantyExpiryDate: new Date('2025-12-31'),
        createdBy: user._id
      });

      await machine3.save();
      console.log('Test machine M003 created successfully');
    } else {
      console.log('Machine M003 already exists');
    }

    console.log('Test machine M003 setup completed!');
    process.exit(0);

  } catch (error) {
    console.error('Error creating test machine:', error);
    process.exit(1);
  }
}

createM003Machine();