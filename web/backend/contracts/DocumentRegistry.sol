// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DocumentRegistry {
    address public owner;

    struct DocumentRecord {
        string documentId;
        string studentId;
        string studentName;
        uint256 blockTimestamp;
        uint256 blockNumber;
        bool isRegistered;
    }

    mapping(string => DocumentRecord) private registry;

    event DocumentRegistered(
        string indexed documentHash,
        string documentId,
        string studentId,
        string studentName,
        uint256 blockTimestamp,
        uint256 blockNumber
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the contract owner can perform this action");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerDocument(
        string memory _documentHash,
        string memory _documentId,
        string memory _studentId,
        string memory _studentName
    ) public onlyOwner {
        require(!registry[_documentHash].isRegistered, "Document hash already registered");

        registry[_documentHash] = DocumentRecord({
            documentId: _documentId,
            studentId: _studentId,
            studentName: _studentName,
            blockTimestamp: block.timestamp,
            blockNumber: block.number,
            isRegistered: true
        });

        emit DocumentRegistered(
            _documentHash,
            _documentId,
            _studentId,
            _studentName,
            block.timestamp,
            block.number
        );
    }

    function verifyDocument(string memory _documentHash)
        public
        view
        returns (
            bool isRegistered,
            string memory documentId,
            string memory studentId,
            string memory studentName,
            uint256 blockTimestamp,
            uint256 blockNumber
        )
    {
        DocumentRecord memory record = registry[_documentHash];
        return (
            record.isRegistered,
            record.documentId,
            record.studentId,
            record.studentName,
            record.blockTimestamp,
            record.blockNumber
        );
    }
}
