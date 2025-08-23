const mongoose = require('mongoose');
require('dotenv').config();

const Site = require('../models/Site');
const User = require('../models/User');

async function createSampleSites() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find an admin user to assign as creator
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    // Sample sites data
    const sampleSites = [
      {
        siteId: 'SITE001',
        siteName: 'Mumbai Central Mall',
        status: 'active',
        location: {
          address: {
            street: 'Phoenix MarketCity, Kurla West',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400070',
            country: 'India'
          },
          coordinates: {
            latitude: 19.0825,
            longitude: 72.8811
          },
          landmark: 'Near Kurla Railway Station',
          zone: 'Commercial'
        },
        configuration: {
          totalMachines: 3,
          totalCapacity: 24,
          supportedVehicleTypes: ['two-wheeler', 'four-wheeler'],
          operatingHours: {
            monday: { isOpen: true, openTime: '06:00', closeTime: '23:00' },
            tuesday: { isOpen: true, openTime: '06:00', closeTime: '23:00' },
            wednesday: { isOpen: true, openTime: '06:00', closeTime: '23:00' },
            thursday: { isOpen: true, openTime: '06:00', closeTime: '23:00' },
            friday: { isOpen: true, openTime: '06:00', closeTime: '23:00' },
            saturday: { isOpen: true, openTime: '06:00', closeTime: '23:00' },
            sunday: { isOpen: true, openTime: '08:00', closeTime: '22:00' }
          }
        },
        pricing: {
          twoWheeler: { baseRate: 10, minimumCharge: 10 },
          fourWheeler: { baseRate: 20, minimumCharge: 20 },
          peakHourMultiplier: 1.5,
          peakHours: { start: '08:00', end: '20:00' }
        },
        siteManager: {
          name: 'Rajesh Kumar',
          phoneNumber: '9876543210',
          email: 'rajesh.mumbai@sparkee.com'
        },
        createdBy: adminUser._id
      },
      {
        siteId: 'SITE002',
        siteName: 'Delhi Connaught Place',
        status: 'active',
        location: {
          address: {
            street: 'Block A, Connaught Place',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110001',
            country: 'India'
          },
          coordinates: {
            latitude: 28.6304,
            longitude: 77.2177
          },
          landmark: 'Near Rajiv Chowk Metro Station',
          zone: 'Commercial'
        },
        configuration: {
          totalMachines: 2,
          totalCapacity: 16,
          supportedVehicleTypes: ['two-wheeler', 'four-wheeler'],
          operatingHours: {
            monday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
            tuesday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
            wednesday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
            thursday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
            friday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
            saturday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
            sunday: { isOpen: true, openTime: '08:00', closeTime: '21:00' }
          }
        },
        pricing: {
          twoWheeler: { baseRate: 15, minimumCharge: 15 },
          fourWheeler: { baseRate: 25, minimumCharge: 25 },
          peakHourMultiplier: 1.8,
          peakHours: { start: '09:00', end: '19:00' }
        },
        siteManager: {
          name: 'Priya Sharma',
          phoneNumber: '9876543211',
          email: 'priya.delhi@sparkee.com'
        },
        createdBy: adminUser._id
      },
      {
        siteId: 'SITE003',
        siteName: 'Bangalore MG Road',
        status: 'active',
        location: {
          address: {
            street: 'MG Road Metro Station',
            city: 'Bangalore',
            state: 'Karnataka',
            pincode: '560001',
            country: 'India'
          },
          coordinates: {
            latitude: 12.9716,
            longitude: 77.5946
          },
          landmark: 'Near Trinity Metro Station',
          zone: 'Commercial'
        },
        configuration: {
          totalMachines: 4,
          totalCapacity: 32,
          supportedVehicleTypes: ['two-wheeler', 'four-wheeler'],
          operatingHours: {
            monday: { isOpen: true, openTime: '06:30', closeTime: '23:30' },
            tuesday: { isOpen: true, openTime: '06:30', closeTime: '23:30' },
            wednesday: { isOpen: true, openTime: '06:30', closeTime: '23:30' },
            thursday: { isOpen: true, openTime: '06:30', closeTime: '23:30' },
            friday: { isOpen: true, openTime: '06:30', closeTime: '23:30' },
            saturday: { isOpen: true, openTime: '06:30', closeTime: '23:30' },
            sunday: { isOpen: true, openTime: '07:00', closeTime: '23:00' }
          }
        },
        pricing: {
          twoWheeler: { baseRate: 12, minimumCharge: 12 },
          fourWheeler: { baseRate: 22, minimumCharge: 22 },
          peakHourMultiplier: 1.6,
          peakHours: { start: '08:30', end: '19:30' }
        },
        siteManager: {
          name: 'Arun Reddy',
          phoneNumber: '9876543212',
          email: 'arun.bangalore@sparkee.com'
        },
        createdBy: adminUser._id
      }
    ];

    // Create sites
    for (const siteData of sampleSites) {
      const existingSite = await Site.findOne({ siteId: siteData.siteId });
      if (existingSite) {
        console.log(`⚠️  Site ${siteData.siteId} already exists, skipping...`);
        continue;
      }

      const site = new Site(siteData);
      await site.save();
      console.log(`✅ Created site: ${site.siteId} - ${site.siteName}`);
    }

    // Assign admin user to all sites
    const sites = await Site.find();
    const siteAssignments = sites.map(site => ({
      site: site._id,
      role: 'site-admin',
      permissions: [
        'create_booking',
        'update_booking',
        'cancel_booking',
        'view_analytics',
        'manage_customers',
        'manage_machines',
        'view_reports'
      ]
    }));

    // Update admin user with site assignments
    adminUser.assignedSites = siteAssignments;
    adminUser.primarySite = sites[0]._id; // Set first site as primary
    await adminUser.save();

    console.log(`✅ Assigned admin user ${adminUser.operatorId} to all sites`);
    console.log(`📋 Total sites created: ${sites.length}`);
    console.log('🎉 Sample sites setup completed successfully!');

    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating sample sites:', error);
    process.exit(1);
  }
}

createSampleSites();