require('dotenv').config();
const Web3 = require('web3');
const fs = require("fs");
const path = require("path");

// Set up Web3 with HTTP provider
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.PROVIDER_URL));

// Load compiled contract ABI and address
const contractJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../build/contracts/HealthRecord.json")));
const contractABI = contractJSON.abi;
const contractAddress = process.env.CONTRACT_ADDRESS;

// Create contract instance
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Function to push record string to blockchain
async function pushToBlockchain(patientDataString) {
  try {
    const accounts = await web3.eth.getAccounts();
    const fromAccount = accounts[0];

    console.log("Pushing to blockchain:", patientDataString);

    const receipt = await contract.methods.addRecord(patientDataString).send({
      from: fromAccount,
      gas: 300000,
    });

    return receipt.transactionHash;
  } catch (err) {
    console.error("Blockchain error:", err);
    throw err;
  }
}
async function getFromBlockchain(index) {
  try {
    const record = await contract.methods.getRecord(index).call();
    console.log(`Record at index ${index}:`, record);
    return record;
  } catch (err) {
    console.error("Error retrieving record from blockchain:", err);
    throw err;
  }
}

module.exports = { pushToBlockchain,getFromBlockchain };
