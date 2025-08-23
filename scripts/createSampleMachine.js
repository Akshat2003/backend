const mongoose = require('mongoose');
require('dotenv').config();

const Machine = require('../models/Machine');
const User = require('../models/User');

async function createSampleMachine() {
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

    // Check if machines already exist
    const existingM001 = await Machine.findOne({ machineNumber: 'M001' });
    const existingM002 = await Machine.findOne({ machineNumber: 'M002' });

    if (!existingM001) {
      // Create a sample machine
      const sampleMachine = new Machine({
        machineNumber: 'M001',
        machineName: 'Main Parking Machine A',
        status: 'online',
        capacity: {
          total: 8,
          available: 8,
          occupied: 0,
          maintenance: 0
        },
        location: {
          building: 'Main Building',
          floor: 'Ground Floor',
          zone: 'Zone A',
          coordinates: {
            latitude: 12.9716,
            longitude: 77.5946
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
          name: 'Mechanical Systems Pvt Ltd',
          contactPerson: 'John Doe',
          phoneNumber: '9876543210',
          email: 'contact@mechsys.com'
        },
        warrantyExpiryDate: new Date('2025-12-31'),
        createdBy: user._id
      });

      await sampleMachine.save();
      console.log('Sample machine M001 created successfully');
    } else {
      console.log('Machine M001 already exists');
    }

    if (!existingM002) {
      // Create another machine
      const machine2 = new Machine({
        machineNumber: 'M002',
        machineName: 'Main Parking Machine B',
        status: 'online',
        capacity: {
          total: 6,
          available: 6,
          occupied: 0,
          maintenance: 0
        },
        location: {
          building: 'Main Building',
          floor: 'Ground Floor',
          zone: 'Zone B',
          coordinates: {
            latitude: 12.9720,
            longitude: 77.5950
          }
        },
        specifications: {
          maxVehicleLength: 3000, // mm
          maxVehicleWidth: 1500, // mm
          maxVehicleHeight: 2000, // mm
          maxVehicleWeight: 500, // kg
          supportedVehicleTypes: ['two-wheeler']
        },
        vendor: {
          name: 'Mechanical Systems Pvt Ltd',
          contactPerson: 'John Doe',
          phoneNumber: '9876543210',
          email: 'contact@mechsys.com'
        },
        warrantyExpiryDate: new Date('2025-12-31'),
        createdBy: user._id
      });

      await machine2.save();
      console.log('Sample machine M002 created successfully');
    } else {
      console.log('Machine M002 already exists');
    }

    console.log('Sample machines setup completed!');
    process.exit(0);

  } catch (error) {
    console.error('Error creating sample machine:', error);
    process.exit(1);
  }
}

createSampleMachine();