// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HealthRecord {
    struct Record {
        uint256 timestamp;
        string patientData;
    }

    Record[] private records;  // Stored records

    event RecordAdded(uint256 indexed recordId, string patientData, uint256 timestamp);

    // Add a new health record
    function addRecord(string memory _patientData) public {
        records.push(Record({
            timestamp: block.timestamp,
            patientData: _patientData
        }));
        emit RecordAdded(records.length - 1, _patientData, block.timestamp);
    }

    // Get a single record by index
    function getRecord(uint256 _index) public view returns (string memory patientData, uint256 timestamp) {
        require(_index < records.length, "Invalid index");
        Record memory r = records[_index];
        return (r.patientData, r.timestamp);
    }

    // ✅ Get total number of records
    function getRecordsCount() public view returns (uint256 count) {
        return records.length;
    }
}
