const { ethers } = require("ethers");
const { wallet } = require("../config/blockchain");
const contractJson = require("../abis/TransactionLedger.json");

const getContract = () => {
  if (!wallet) {
    throw new Error('Blockchain wallet is not configured. Set a valid SERVER_WALLET_PRIVATE_KEY or BLOCKCHAIN_PRIVATE_KEY.');
  }

  return new ethers.Contract(
    process.env.CONTRACT_ADDRESS,
    contractJson.abi,
    wallet
  );
};

const buildUnavailableVerificationResult = (referenceNumber, errorMessage) => ({
  referenceNumber,
  typeOfDocument: '',
  nameOfStudent: '',
  studentIDNumber: '',
  nameOfSchool: '',
  yearGraduated: '0',
  recordedBy: '',
  timestamp: '0',
  exists: false,
  error: errorMessage,
});

const recordTransactionOnBlockchain = async ({
  referenceNumber,
  typeOfDocument,
  nameOfStudent,
  studentIDNumber,
  nameOfSchool,
  yearGraduated,
}) => {
  try {
    const contract = getContract();
    const tx = await contract.recordTransaction(
      referenceNumber,
      typeOfDocument,
      nameOfStudent,
      studentIDNumber,
      nameOfSchool,
      yearGraduated
    );

    const receipt = await tx.wait();

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 1 ? "Recorded" : "Failed",
    };
  } catch (error) {
    console.warn(`[Blockchain] Recording failed: ${error.message}`);
    return {
      transactionHash: "",
      blockNumber: null,
      status: "Failed",
      error: error.message,
    };
  }
};

const verifyTransactionOnBlockchain = async (referenceNumber) => {
  try {
    const contract = getContract();
    const result = await contract.verifyTransaction(referenceNumber);

    if (!result || result.length < 9) {
      return buildUnavailableVerificationResult(
        referenceNumber,
        'Unexpected blockchain response shape from verifyTransaction.'
      );
    }

    return {
      referenceNumber: result[0],
      typeOfDocument: result[1],
      nameOfStudent: result[2],
      studentIDNumber: result[3],
      nameOfSchool: result[4],
      yearGraduated: result[5].toString(),
      recordedBy: result[6],
      timestamp: result[7].toString(),
      exists: result[8],
      error: null,
    };
  } catch (error) {
    if (error?.message?.includes('Blockchain wallet is not configured')) {
      return buildUnavailableVerificationResult(
        referenceNumber,
        'Blockchain wallet is not configured. Verification is unavailable until a valid private key is set.'
      );
    }

    const isDecodeMismatch =
      error?.code === 'BAD_DATA' ||
      /could not decode result data/i.test(error?.message || '');

    if (isDecodeMismatch) {
      return buildUnavailableVerificationResult(
        referenceNumber,
        `Configured blockchain contract at ${process.env.CONTRACT_ADDRESS} does not return TransactionLedger data. Check CONTRACT_ADDRESS and redeploy the ledger contract.`
      );
    }

    return buildUnavailableVerificationResult(referenceNumber, error?.message || 'Blockchain verification failed.');
  }
};

module.exports = {
  recordTransactionOnBlockchain,
  verifyTransactionOnBlockchain,
};