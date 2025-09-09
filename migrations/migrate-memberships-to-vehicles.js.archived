#!/usr/bin/env node

/**
 * Migration Script: Move legacy memberships to vehicle-based memberships
 * This script migrates existing customer memberships to their first vehicle
 * Run this once after deploying the new vehicle-based membership system
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import Customer model
const Customer = require('../models/Customer');

const migrateToVehicleMemberships = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parking-system', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    console.log('Starting membership migration...\n');
    
    // Find all customers with legacy memberships
    const customersWithMembership = await Customer.find({
      'membership.membershipNumber': { $exists: true, $ne: null },
      'membership.isActive': true
    });
    
    console.log(`Found ${customersWithMembership.length} customers with active memberships to migrate\n`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const customer of customersWithMembership) {
      try {
        console.log(`Processing customer: ${customer.fullName} (${customer.phoneNumber})`);
        
        // Check if customer has vehicles
        if (!customer.vehicles || customer.vehicles.length === 0) {
          console.log(`  ⚠️  No vehicles found for customer. Skipping...`);
          errors.push({
            customer: customer.fullName,
            reason: 'No vehicles registered'
          });
          errorCount++;
          continue;
        }
        
        // Find the first active vehicle (preferably four-wheeler)
        let targetVehicle = customer.vehicles.find(v => 
          v.isActive && v.vehicleType === 'four-wheeler'
        );
        
        // If no four-wheeler, use any active vehicle
        if (!targetVehicle) {
          targetVehicle = customer.vehicles.find(v => v.isActive);
        }
        
        // If still no active vehicle, use first vehicle
        if (!targetVehicle) {
          targetVehicle = customer.vehicles[0];
        }
        
        console.log(`  → Migrating membership to vehicle: ${targetVehicle.vehicleNumber} (${targetVehicle.vehicleType})`);
        
        // Copy membership to the vehicle
        targetVehicle.membership = {
          membershipNumber: customer.membership.membershipNumber,
          pin: customer.membership.pin,
          membershipType: customer.membership.membershipType,
          issuedDate: customer.membership.issuedDate,
          expiryDate: customer.membership.expiryDate,
          validityTerm: customer.membership.validityTerm,
          isActive: customer.membership.isActive,
          createdBy: customer.membership.createdBy,
          createdAt: customer.membership.createdAt
        };
        
        // Move old membership to legacyMembership field
        customer.legacyMembership = { ...customer.membership };
        
        // Clear the old membership field
        customer.membership = undefined;
        
        // Save the updated customer
        await customer.save();
        
        console.log(`  ✅ Successfully migrated membership ${targetVehicle.membership.membershipNumber}`);
        successCount++;
        
      } catch (error) {
        console.error(`  ❌ Error migrating customer ${customer.fullName}:`, error.message);
        errors.push({
          customer: customer.fullName,
          reason: error.message
        });
        errorCount++;
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total customers processed: ${customersWithMembership.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed migrations: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\nFailed migrations:');
      errors.forEach(err => {
        console.log(`  - ${err.customer}: ${err.reason}`);
      });
    }
    
    // Check for customers without memberships but with vehicles
    const customersWithoutMembership = await Customer.find({
      $or: [
        { 'membership.membershipNumber': { $exists: false } },
        { 'membership.membershipNumber': null },
        { 'membership.isActive': false }
      ],
      'vehicles.0': { $exists: true }
    });
    
    console.log(`\n${customersWithoutMembership.length} customers have vehicles but no membership (ready for new memberships)`);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

// Run migration if executed directly
if (require.main === module) {
  console.log('Vehicle-Based Membership Migration Script');
  console.log('=========================================\n');
  
  // Add confirmation prompt for production
  if (process.env.NODE_ENV === 'production') {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('This will migrate all existing memberships. Continue? (yes/no): ', (answer) => {
      if (answer.toLowerCase() === 'yes') {
        rl.close();
        migrateToVehicleMemberships();
      } else {
        console.log('Migration cancelled');
        rl.close();
        process.exit(0);
      }
    });
  } else {
    migrateToVehicleMemberships();
  }
}

module.exports = migrateToVehicleMemberships;