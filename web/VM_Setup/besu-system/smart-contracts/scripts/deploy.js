const hre = require("hardhat");

async function main() {
  const TransactionLedger = await hre.ethers.getContractFactory(
    "TransactionLedger"
  );

  const transactionLedger = await TransactionLedger.deploy();

  await transactionLedger.waitForDeployment();

  console.log(
    "TransactionLedger deployed to:",
    await transactionLedger.getAddress()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});