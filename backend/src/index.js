require("dotenv").config();
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

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function serializeGrant(id, g) {
  return {
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
  };
}

function parseGrantId(raw) {
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function parsePagination(query) {
  let limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
  let offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(limit) || limit < 0) limit = DEFAULT_LIMIT;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;
  limit = Math.min(limit, MAX_LIMIT);
  return { limit, offset };
}

function asyncRoute(fn) {
  return (req, res) => fn(req, res).catch((err) => res.status(500).json({ error: err.message }));
}

// GET /api/health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", contractAddress: contractAddress.address });
});

// GET /api/count
app.get(
  "/api/count",
  asyncRoute(async (req, res) => {
    const count = await contract.grantCount();
    res.json({ count: Number(count) });
  })
);

// GET /api/grants?limit=&offset=
app.get(
  "/api/grants",
  asyncRoute(async (req, res) => {
    const count = Number(await contract.grantCount());
    const { limit, offset } = parsePagination(req.query);

    const ids = [];
    for (let id = offset; id < count && ids.length < limit; id++) ids.push(id);

    const grants = await Promise.all(ids.map((id) => contract.getGrant(id)));
    res.json({
      total: count,
      limit,
      offset,
      grants: grants.map((g, i) => serializeGrant(ids[i], g)),
    });
  })
);

// GET /api/grants/:id
app.get(
  "/api/grants/:id",
  asyncRoute(async (req, res) => {
    const id = parseGrantId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid grant id" });

    const count = Number(await contract.grantCount());
    if (id >= count) return res.status(404).json({ error: "Grant does not exist" });

    const g = await contract.getGrant(id);
    res.json(serializeGrant(id, g));
  })
);

// GET /api/grants/:id/approved/:address
app.get(
  "/api/grants/:id/approved/:address",
  asyncRoute(async (req, res) => {
    const id = parseGrantId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid grant id" });
    if (!ethers.isAddress(req.params.address)) {
      return res.status(400).json({ error: "Invalid address" });
    }

    const count = Number(await contract.grantCount());
    if (id >= count) return res.status(404).json({ error: "Grant does not exist" });

    const approved = await contract.hasApproved(id, req.params.address);
    res.json({ approved });
  })
);

// GET /api/reviewers/:address/grants
app.get(
  "/api/reviewers/:address/grants",
  asyncRoute(async (req, res) => {
    if (!ethers.isAddress(req.params.address)) {
      return res.status(400).json({ error: "Invalid address" });
    }
    const ids = await contract.getGrantIdsByReviewer(req.params.address);
    const grants = await Promise.all(ids.map((id) => contract.getGrant(id)));
    res.json({ grants: grants.map((g, i) => serializeGrant(Number(ids[i]), g)) });
  })
);

// GET /api/proposers/:address/grants
app.get(
  "/api/proposers/:address/grants",
  asyncRoute(async (req, res) => {
    if (!ethers.isAddress(req.params.address)) {
      return res.status(400).json({ error: "Invalid address" });
    }
    const ids = await contract.getGrantIdsByProposer(req.params.address);
    const grants = await Promise.all(ids.map((id) => contract.getGrant(id)));
    res.json({ grants: grants.map((g, i) => serializeGrant(Number(ids[i]), g)) });
  })
);

app.use((req, res) => res.status(404).json({ error: "Not found" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
