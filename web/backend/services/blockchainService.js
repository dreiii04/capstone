const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

// Path to persistent ledger file for simulated fallback mode
const LEDGER_PATH = path.join(__dirname, '../data/blockchain_ledger.json');

// Ensure database/data directory exists
const dataDir = path.dirname(LEDGER_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Pre-compiled Smart Contract ABI for DocumentRegistry
const CONTRACT_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "string", "name": "documentHash", "type": "string" },
            { "indexed": false, "internalType": "string", "name": "documentId", "type": "string" },
            { "indexed": false, "internalType": "string", "name": "studentId", "type": "string" },
            { "indexed": false, "internalType": "string", "name": "studentName", "type": "string" },
            { "indexed": false, "internalType": "uint256", "name": "blockTimestamp", "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "blockNumber", "type": "uint256" }
        ],
        "name": "DocumentRegistered",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string", "name": "_documentHash", "type": "string" },
            { "internalType": "string", "name": "_documentId", "type": "string" },
            { "internalType": "string", "name": "_studentId", "type": "string" },
            { "internalType": "string", "name": "_studentName", "type": "string" }
        ],
        "name": "registerDocument",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string", "name": "_documentHash", "type": "string" }
        ],
        "name": "verifyDocument",
        "outputs": [
            { "internalType": "bool", "name": "isRegistered", "type": "bool" },
            { "internalType": "string", "name": "documentId", "type": "string" },
            { "internalType": "string", "name": "studentId", "type": "string" },
            { "internalType": "string", "name": "studentName", "type": "string" },
            { "internalType": "uint256", "name": "blockTimestamp", "type": "uint256" },
            { "internalType": "uint256", "name": "blockNumber", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

class BlockchainService {
    constructor() {
        this.rpcUrl = process.env.BLOCKCHAIN_RPC_URL || process.env.BESU_RPC_URL || 'http://127.0.0.1:8545';
        this.contractAddress = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
        this.privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.SERVER_WALLET_PRIVATE_KEY;
        this.isFallbackMode = true;
        this.provider = null;
        this.contract = null;
        this.signer = null;

        // Initialize Ledger for simulated mode
        this._initLedger();
        
        // Try initializing actual blockchain connection in background
        this.initBlockchainConnection();
    }

    // Try to connect to real local/remote blockchain node
    async initBlockchainConnection() {
        try {
            console.log(`[Blockchain] Attempting RPC connection to ${this.rpcUrl}...`);
            this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
            
            // Check connectivity with a quick network query and 2s timeout
            const netTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
            await Promise.race([this.provider.getNetwork(), netTimeout]);

            if (this.privateKey) {
                this.signer = new ethers.Wallet(this.privateKey, this.provider);
                this.contract = new ethers.Contract(this.contractAddress, CONTRACT_ABI, this.signer);
                this.isFallbackMode = false;
                console.log(`[Blockchain] Live mode enabled successfully! Contract: ${this.contractAddress}`);
            } else {
                console.log(`[Blockchain] RPC connected, but BLOCKCHAIN_PRIVATE_KEY is missing. Defaulting to Simulated Fallback Mode.`);
                this.isFallbackMode = true;
            }
        } catch (error) {
            console.warn(`[Blockchain] Live node not reachable (${error.message}). Running with HIGH-FIDELITY CRYPTOGRAPHIC SIMULATED FALLBACK.`);
            this.isFallbackMode = true;
        }
    }

    // Helper: Initialize persistent simulated ledger
    _initLedger() {
        if (!fs.existsSync(LEDGER_PATH)) {
            // Create a Genesis block
            const genesisBlock = {
                blockNumber: 100000,
                blockHash: '0000a12e8b4e72c83d6a4fe9f1d24c000bb78efcfdfab789abce2c67de9f8d1b',
                previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
                timestamp: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
                transactions: [],
                difficulty: 4,
                nonce: 48921,
                miner: 'VerifiTOR Validator Genesis Node'
            };
            fs.writeFileSync(LEDGER_PATH, JSON.stringify([genesisBlock], null, 4));
            console.log('[Blockchain Ledger] Genesis block successfully created.');
        }
    }

    // Helper: Retrieve all blocks in simulated ledger
    _getLedger() {
        try {
            const data = fs.readFileSync(LEDGER_PATH, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading blockchain ledger:', error);
            return [];
        }
    }

    // Helper: Save all blocks to ledger file
    _saveLedger(blocks) {
        try {
            fs.writeFileSync(LEDGER_PATH, JSON.stringify(blocks, null, 4));
        } catch (error) {
            console.error('Error writing blockchain ledger:', error);
        }
    }

    /**
     * Anchor a document hash onto the blockchain
     * @param {string} documentId System Doc ID
     * @param {string} studentId System Student ID
     * @param {string} studentName Name of student
     * @param {string} documentHash SHA-256 digital fingerprint
     */
    async anchorDocumentHash(documentId, studentId, studentName, documentHash) {
        // Double check RPC connection state
        if (this.isFallbackMode) {
            await this.initBlockchainConnection();
        }

        if (!this.isFallbackMode) {
            try {
                console.log(`[Blockchain] Anchoring hash ${documentHash} on live contract...`);
                const tx = await this.contract.registerDocument(documentHash, documentId, studentId, studentName);
                console.log(`[Blockchain] Transaction submitted. Hash: ${tx.hash}`);
                
                const receipt = await tx.wait();
                console.log(`[Blockchain] Hash successfully anchored in block: ${receipt.blockNumber}`);
                
                return {
                    success: true,
                    txID: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    blockHash: receipt.blockHash,
                    timestamp: new Date().toISOString(),
                    miner: 'Ethereum Network Node',
                    gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : '64182',
                    status: 'Secured on Live Ledger',
                    isSimulated: false,
                    contractAddress: this.contractAddress
                };
            } catch (err) {
                console.error(`[Blockchain] Live transaction failed. Falling back to local ledger:`, err.message);
            }
        }

        // --- Simulated Mode (Cryptographic Proof-of-Work Mining) ---
        console.log(`[Blockchain] Anchoring hash ${documentHash} in Cryptographic Simulated Ledger...`);
        const blocks = this._getLedger();
        const lastBlock = blocks[blocks.length - 1];

        // Prepare new block parameters
        const nextBlockNumber = lastBlock.blockNumber + 1;
        const previousHash = lastBlock.blockHash;
        const timestamp = Date.now();
        const txID = '0x' + crypto.createHash('sha256').update(documentHash + timestamp).digest('hex');
        
        const newTransaction = {
            txID,
            documentHash,
            documentId,
            studentId,
            studentName,
            timestamp,
            sender: '0x956FD9C4B7E03A59AFC002F60941B3E64180AA3',
            contractAddress: this.contractAddress
        };

        // Cryptographic proof-of-work simulation (Difficulty 4: block hash starts with '0000')
        let nonce = 0;
        let blockHash = '';
        const difficulty = 4;
        const target = '0'.repeat(difficulty);
        const dataToHash = previousHash + JSON.stringify(newTransaction) + timestamp;

        while (true) {
            blockHash = crypto.createHash('sha256').update(dataToHash + nonce).digest('hex');
            if (blockHash.substring(0, difficulty) === target) {
                break;
            }
            nonce++;
            // Hard limit to prevent freeze-ups (usually takes < 0.1s for difficulty 4)
            if (nonce > 100000) break;
        }

        const newBlock = {
            blockNumber: nextBlockNumber,
            blockHash,
            previousHash,
            timestamp,
            transactions: [newTransaction],
            difficulty,
            nonce,
            miner: 'VerifiTOR Proof-of-Work Validator Node-01'
        };

        blocks.push(newBlock);
        this._saveLedger(blocks);

        console.log(`[Blockchain] Mined Block ${nextBlockNumber} with hash: ${blockHash} (Nonce: ${nonce})`);

        return {
            success: true,
            txID,
            blockNumber: nextBlockNumber,
            blockHash,
            timestamp: new Date(timestamp).toISOString(),
            miner: 'VerifiTOR Proof-of-Work Validator Node-01',
            gasUsed: '57419',
            status: 'Secured on Local Cryptographic Ledger',
            isSimulated: true,
            contractAddress: this.contractAddress
        };
    }

    /**
     * Verify a document hash against the blockchain ledger
     * @param {string} documentHash SHA-256 digital fingerprint
     */
    async verifyDocumentHash(documentHash) {
        if (this.isFallbackMode) {
            await this.initBlockchainConnection();
        }

        if (!this.isFallbackMode) {
            try {
                console.log(`[Blockchain] Verifying hash ${documentHash} on live contract...`);
                const result = await this.contract.verifyDocument(documentHash);
                const [isRegistered, documentId, studentId, studentName, blockTimestamp, blockNumber] = result;

                if (isRegistered) {
                    return {
                        isVerified: true,
                        documentId,
                        studentId,
                        studentName,
                        date: new Date(Number(blockTimestamp) * 1000).toISOString(),
                        blockNumber: Number(blockNumber),
                        status: 'Secured on Live Ledger',
                        isSimulated: false,
                        contractAddress: this.contractAddress
                    };
                }
            } catch (err) {
                console.error('[Blockchain] Live verification failed, checking local ledger fallback...', err.message);
            }
        }

        // --- Simulated Verification ---
        const blocks = this._getLedger();
        
        // Scan backwards through the chain
        for (let i = blocks.length - 1; i >= 0; i--) {
            const block = blocks[i];
            const matchingTx = block.transactions.find(tx => tx.documentHash === documentHash);
            if (matchingTx) {
                return {
                    isVerified: true,
                    txID: matchingTx.txID,
                    documentId: matchingTx.documentId,
                    studentId: matchingTx.studentId,
                    studentName: matchingTx.studentName,
                    date: new Date(matchingTx.timestamp).toISOString(),
                    blockNumber: block.blockNumber,
                    blockHash: block.blockHash,
                    nonce: block.nonce,
                    miner: block.miner,
                    status: 'Secured on Local Cryptographic Ledger',
                    isSimulated: true,
                    contractAddress: this.contractAddress
                };
            }
        }

        return {
            isVerified: false,
            status: 'NOT FOUND ON LEDGER'
        };
    }
}

module.exports = new BlockchainService();
