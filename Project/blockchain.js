require('dotenv').config();
const Web3 = require('web3');
const fs = require("fs");
const path = require("path");

const fernet = require('fernet');
;
// Load base64-encoded key (same as in your Python encryption_key)
const secret = new fernet.Secret(process.env.FERNET_KEY);  // Or read from file

function decryptFernet(encryptedString) {
  const token = new fernet.Token({
    secret: secret,
    token: encryptedString,
    ttl: 0, // Optional: set to 0 to disable expiry checks
  });

  try {
    const decrypted = token.decode();
    return decrypted;
  } catch (error) {
    console.error("Fernet decryption failed:", error.message);
    throw error;
  }
}


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
    const accounts = await web3.eth.getAccounts();
    const fromAccount = accounts[0];
    const record = await contract.methods.getRecord(index).call({
      from: fromAccount,
      gas: 300000,
    });
    console.log(`Record at index ${index}:`, record);
    return record;
  } catch (err) {
    console.error("Error retrieving record from blockchain:", err);
    throw err;
  }
}

module.exports = { pushToBlockchain, getFromBlockchain };
