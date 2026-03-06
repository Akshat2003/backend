const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
require('../models/Site');

async function listSiteAssignments() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const users = await User.find({})
    .select('operatorId firstName lastName role status assignedSites primarySite')
    .populate({ path: 'assignedSites.site', select: 'siteId siteName location' })
    .populate({ path: 'primarySite', select: 'siteId siteName location' });

  users.forEach(u => {
    const primary = u.primarySite
      ? u.primarySite.siteId + ' - ' + u.primarySite.siteName
      : 'none';
    const assigned = u.assignedSites.length
      ? u.assignedSites.map(a => a.site ? a.site.siteId + ' - ' + a.site.siteName + ' (' + a.role + ')' : 'unknown').join(', ')
      : 'none';
    console.log(u.operatorId + ' [' + u.role + '] ' + u.firstName + ' ' + u.lastName);
    console.log('  Primary Site : ' + primary);
    console.log('  Assigned Sites: ' + assigned);
    console.log();
  });

  process.exit(0);
}

listSiteAssignments().catch(err => { console.error(err); process.exit(1); });
