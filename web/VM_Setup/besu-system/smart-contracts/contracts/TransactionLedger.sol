// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TransactionLedger {
    struct TransactionRecord {
        string referenceNumber;
        string typeOfDocument;
        string nameOfStudent;
        string studentSONumber;
        string nameOfSchool;
        uint256 yearGraduated;
        address recordedBy;
        uint256 timestamp;
        bool exists;
    }

    mapping(string => TransactionRecord) private transactions;

    event TransactionRecorded(
        string referenceNumber,
        string typeOfDocument,
        string nameOfStudent,
        address indexed recordedBy,
        uint256 timestamp
    );

    function recordTransaction(
        string memory _referenceNumber,
        string memory _typeOfDocument,
        string memory _nameOfStudent,
        string memory _studentSONumber,
        string memory _nameOfSchool,
        uint256 _yearGraduated
    ) public {
        require(
            !transactions[_referenceNumber].exists,
            "Transaction already exists"
        );

        transactions[_referenceNumber] = TransactionRecord({
            referenceNumber: _referenceNumber,
            typeOfDocument: _typeOfDocument,
            nameOfStudent: _nameOfStudent,
            studentSONumber: _studentSONumber,
            nameOfSchool: _nameOfSchool,
            yearGraduated: _yearGraduated,
            recordedBy: msg.sender,
            timestamp: block.timestamp,
            exists: true
        });

        emit TransactionRecorded(
            _referenceNumber,
            _typeOfDocument,
            _nameOfStudent,
            msg.sender,
            block.timestamp
        );
    }

    function verifyTransaction(
        string memory _referenceNumber
    )
        public
        view
        returns (
            string memory referenceNumber,
            string memory typeOfDocument,
            string memory nameOfStudent,
            string memory studentSONumber,
            string memory nameOfSchool,
            uint256 yearGraduated,
            address recordedBy,
            uint256 timestamp,
            bool exists
        )
    {
        TransactionRecord memory record = transactions[_referenceNumber];

        return (
            record.referenceNumber,
            record.typeOfDocument,
            record.nameOfStudent,
            record.studentSONumber,
            record.nameOfSchool,
            record.yearGraduated,
            record.recordedBy,
            record.timestamp,
            record.exists
        );
    }
}