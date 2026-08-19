require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 5000;
const BESU_RPC_URL = process.env.BESU_RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const SERVER_WALLET_PRIVATE_KEY = process.env.SERVER_WALLET_PRIVATE_KEY;
const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const FRONTEND_URL = process.env.FRONTEND_URL;

module.exports = {
    MONGODB_URI,
    JWT_SECRET,
    PORT,
    BESU_RPC_URL,
    CONTRACT_ADDRESS,
    SERVER_WALLET_PRIVATE_KEY,
    SMTP_EMAIL,
    SMTP_PASSWORD,
    FRONTEND_URL
};
