const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const Blockchain_Transaction = require('../blockchain_essentials/modelBC/blockchainTransactionModel');
const { protect, registrarOrSuperAdmin } = require('../middleware/authMiddleware');

router.use(protect);
router.use(registrarOrSuperAdmin);

router.get('/stats', async (req, res) => {
  try {
    const Refund = require('../models/Refund');
    const totalRequests = await Request.countDocuments();
    const pendingRequests = await Request.countDocuments({ status: 'Pending' });
    const inProcessRequests = await Request.countDocuments({ status: 'In Process' });
    const rejectedRequests = await Request.countDocuments({ status: 'Rejected' });
    const releasedRequests = await Request.countDocuments({ status: 'Released' });
    const blockchainTransactions = await Blockchain_Transaction.countDocuments();
    const pendingRefunds = await Refund.countDocuments({ status: { $regex: /^pending$/i } });

    res.json({
      totalRequests,
      pendingRequests,
      inProcessRequests,
      rejectedRequests,
      releasedRequests,
      blockchainTransactions,
      pendingRefunds
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

router.get('/recent', async (req, res) => {
   try {
     const transactions = await Blockchain_Transaction.find().sort({ createdAt: -1 }).limit(5);
     const notifications = await Notification.find().sort({ date: -1 }).limit(5);
     const pendingRequests = await Request.find({ status: 'Pending' }).sort({ dateRequested: -1 }).limit(5);

     res.json({
         transactions,
         notifications,
         pendingRequests
     });
   } catch (error) {
     res.status(500).json({ message: 'Error fetching recent activity' });
   }
});

module.exports = router;
