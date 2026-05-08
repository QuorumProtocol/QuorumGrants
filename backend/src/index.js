const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const contractAddress = require("./contract-address.json");
const abi = require("./QuorumGrants.abi.json");

const app = express();
app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");
const contract = new ethers.Contract(contractAddress.address, abi, provider);

// GET /api/grants/:id
app.get("/api/grants/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const g = await contract.getGrant(id);
    res.json({
      id,
      proposer: g.proposer,
      recipient: g.recipient,
      amount: g.amount.toString(),
      description: g.description,
      reviewers: g.reviewers,
      quorumThreshold: Number(g.quorumThreshold),
      approvalCount: Number(g.approvalCount),
      executed: g.executed,
      cancelled: g.cancelled,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/grants/:id/approved/:address
app.get("/api/grants/:id/approved/:address", async (req, res) => {
  try {
    const approved = await contract.hasApproved(Number(req.params.id), req.params.address);
    res.json({ approved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/count
app.get("/api/count", async (req, res) => {
  try {
    const count = await contract.grantCount();
    res.json({ count: Number(count) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
