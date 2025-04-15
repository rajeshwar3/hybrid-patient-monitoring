// contracts/HealthRecord.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HealthRecord {
    struct Record {
        uint timestamp;
        string patientData;
    }

    Record[] public records;

    event RecordAdded(uint indexed recordId, string patientData, uint timestamp);

    function addRecord(string memory _patientData) public {
        records.push(Record(block.timestamp, _patientData));
        emit RecordAdded(records.length - 1, _patientData, block.timestamp);
    }

    function getRecord(uint _index) public view returns (string memory, uint) {
        require(_index < records.length, "Invalid index");
        Record memory r = records[_index];
        return (r.patientData, r.timestamp);
    }

    function getRecordsCount() public view returns (uint) {
        return records.length;
    }
}
