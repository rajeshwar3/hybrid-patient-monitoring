// routes/doctorRoutes.js

const express = require("express");
const router = express.Router();
const { MongoClient, ObjectId } = require("mongodb");
const { pushToBlockchain, getFromBlockchain } = require("../blockchain");

// MongoDB connection
const uri = "mongodb://localhost:27017/";
const client = new MongoClient(uri);
const db = client.db("HealthMonitor");

const unapprovedCollection = db.collection("PatientRecords");
const approvedCollection = db.collection("ApprovedRecords");

// ✅ GET: Fetch all unapproved patient records
router.get("/unapproved", async (req, res) => {
  try {
    const unapproved = await unapprovedCollection.find({ approved: false }).toArray();
    res.json(unapproved);
  } catch (err) {
    console.error("Error fetching unapproved records:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ POST: Approve a record and push it to the blockchain
router.post("/approve/:id", async (req, res) => {
  try {
    const recordId = req.params.id;
    const record = await unapprovedCollection.findOne({ _id: new ObjectId(recordId) });

    if (!record) return res.status(404).json({ error: "Record not found" });

    // Mark as approved and move to ApprovedRecords
    record.approved = true;
    await approvedCollection.insertOne(record);
    await unapprovedCollection.deleteOne({ _id: new ObjectId(recordId) });

    // Format data for blockchain
    const dataString = `HR=${record.heart_rate}, SpO2=${record.spo2}, Obj Temp=${record.object_temp}, Amb Temp=${record.ambient_temp}, Pressure=${record.pressure}, Disease=${record.predicted_disease}`;

    // Call blockchain push
    const txHash = await pushToBlockchain(dataString);

    res.json({
      message: "Record approved and pushed to blockchain",
      txHash: txHash
    });

  } catch (err) {
    console.error("Error approving record:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/approved-block/:id", async (req, res) => {
  try {
    const recordId = req.params.id;
    const txResult = await getFromBlockchain(recordId);
    res.json({
      record: txResult
    });
  } catch (err) {
    console.error("Error fetching approved records:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ GET: Fetch all approved records
router.get("/approved", async (req, res) => {
  try {
    const approved = await approvedCollection.find({}).toArray();
    res.json(approved);
  } catch (err) {
    console.error("Error fetching approved records:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
