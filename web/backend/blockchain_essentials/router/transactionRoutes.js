const express = require("express");
const TransactionController = require("../controller/transactionController");

const router = express.Router();

const { protect } = require("../../middleware/authMiddleware");

router.post("/", protect, TransactionController.createTransaction);
router.get("/my-transactions", protect, TransactionController.getMyTransactions);
router.get("/verify/:referenceNumber", TransactionController.verifyTransaction);
router.get("/verify-by-id/:studentIDNumber", TransactionController.verifyTransactionByStudentID);

module.exports = router;