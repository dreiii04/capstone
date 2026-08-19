const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

// Import models
const Student = require('./models/Users/Student');
const Request = require('./models/Request');
const Notification = require('./models/Notification');
const ActivityLog = require('./models/ActivityLog');
const Transaction = require('./models/Transaction');

async function clearDatabase() {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('Error: MONGODB_URI is not set in .env file.');
      process.exit(1);
    }

    console.log('Connecting to MongoDB database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully.');

    // 1. Delete all Student Accounts
    console.log('Clearing student accounts...');
    const deletedStudents = await Student.deleteMany({});
    console.log(`Deleted ${deletedStudents.deletedCount} student accounts.`);

    // 2. Delete all Document Requests
    console.log('Clearing document requests...');
    const deletedRequests = await Request.deleteMany({});
    console.log(`Deleted ${deletedRequests.deletedCount} document requests.`);

    // 3. Delete all Notifications
    console.log('Clearing notifications...');
    const deletedNotifications = await Notification.deleteMany({});
    console.log(`Deleted ${deletedNotifications.deletedCount} notifications.`);

    // 4. Delete all Transactions
    console.log('Clearing payment transactions...');
    const deletedTransactions = await Transaction.deleteMany({});
    console.log(`Deleted ${deletedTransactions.deletedCount} transactions.`);

    // 5. Delete Request-related Activity Logs
    console.log('Clearing student-related activity logs...');
    const deletedLogs = await ActivityLog.deleteMany({
      action: { $in: ['Create Request', 'Login', 'Register'] },
      userEmail: { $ne: 'sysadmin@verifitor.com' } // Keep default super admin logs
    });
    console.log(`Deleted ${deletedLogs.deletedCount} activity log entries.`);

    console.log('\n==================================================');
    console.log('Database successfully cleaned up!');
    console.log('You can now register a fresh account and start fresh.');
    console.log('==================================================');

    process.exit(0);
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exit(1);
  }
}

clearDatabase();
