const { ethers, FetchRequest } = require("ethers");

const rpcUrl = process.env.BESU_RPC_URL || process.env.BLOCKCHAIN_RPC_URL || "http://129.150.50.251:8545";

let provider;
if (rpcUrl.includes("ngrok")) {
  const req = new FetchRequest(rpcUrl);
  req.setHeader("ngrok-skip-browser-warning", "69420");
  provider = new ethers.JsonRpcProvider(req);
} else {
  provider = new ethers.JsonRpcProvider(rpcUrl);
}

let wallet = null;
const privateKey = process.env.SERVER_WALLET_PRIVATE_KEY || process.env.BLOCKCHAIN_PRIVATE_KEY;

if (privateKey) {
  try {
    wallet = new ethers.Wallet(privateKey, provider);
  } catch (error) {
    console.warn(`[Blockchain] Invalid private key configured: ${error.message}`);
  }
}

if (!wallet) {
  console.warn("[Blockchain] No usable wallet configured. Blockchain writes and verifications will be unavailable until a valid private key is set.");
}

module.exports = {
  provider,
  wallet,
};