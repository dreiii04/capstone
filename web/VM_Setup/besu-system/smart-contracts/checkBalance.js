require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL);

  const balance = await provider.getBalance(process.env.MY_WALLET_ADDRESS);

  console.log("Wallet:", process.env.MY_WALLET_ADDRESS);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});