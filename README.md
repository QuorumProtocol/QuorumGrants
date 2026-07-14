# QuorumGrants

A decentralized grant system where funding decisions are made through programmable quorum-based consensus instead of centralized committees.

## Overview

QuorumGrants reimagines grant funding by applying quorum-based consensus mechanisms inspired by Stellar's trust model. Instead of relying on centralized review boards, grant approvals are determined by predefined quorum sets — groups of trusted reviewers whose overlapping approvals trigger funding execution.

Each grant defines its own governance logic (e.g. "3 out of 5 trusted reviewers must approve"). Once a quorum is reached, funds are automatically transferred to the recipient, ensuring transparency and continuous accountability.

This approach reduces bias, increases decentralization, and enables flexible governance structures tailored to different communities — making it especially powerful for DAOs and public goods funding initiatives.

## Features

- **Quorum-based approval** — each grant defines its own reviewer set and threshold
- **Automatic execution** — funds transfer instantly when quorum is reached, no manual trigger needed
- **Proposer cancellation** — grant creators can cancel and reclaim funds before execution
- **On-chain transparency** — all approvals and state changes are emitted as events
- **MetaMask-connected UI** — reviewers and proposers interact directly from the browser

## Project Structure

```
QuorumGrants/
├── contracts/                     # Solidity smart contract + Hardhat tooling
│   ├── src/QuorumGrants.sol       # Core contract
│   ├── scripts/deploy.js          # Deployment script
│   ├── test/QuorumGrants.test.js  # Test suite (10 tests)
│   └── hardhat.config.js
├── backend/                       # Express.js read API
│   └── src/
│       ├── index.js               # REST endpoints
│       └── QuorumGrants.abi.json  # Contract ABI
├── frontend/                      # React + Vite UI
│   └── src/
│       ├── App.jsx                # Main UI (wallet, grants, approve/cancel)
│       └── useContract.js         # ethers.js wallet + contract hook
└── package.json                   # npm workspaces root
```

## Getting Started

### Prerequisites

- Node.js 18+
- MetaMask browser extension

### Install dependencies

```bash
npm install --workspaces
```

### 1. Start a local chain

```bash
cd contracts && npx hardhat node
```

### 2. Deploy the contract

```bash
cd contracts && npm run deploy:local
```

This compiles and deploys the contract, then writes the address to `backend/src/contract-address.json`.

### 3. Configure the frontend

```bash
cp frontend/.env.example frontend/.env
# Edit frontend/.env and set VITE_CONTRACT_ADDRESS to the deployed address
```

### 4. Start the frontend

```bash
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173), connect MetaMask, and start creating grants.

### 5. (Optional) Start the backend API

```bash
cd backend && npm start
```

The API runs on `http://localhost:3001` and exposes read-only endpoints for querying grant state.

## Smart Contract

### `createGrant(recipient, description, reviewers[], quorumThreshold)` — payable

Creates a new grant. The ETH sent with the transaction is locked as the grant amount.

### `approve(id)`

Called by a reviewer. Automatically executes the grant (transfers funds) when the quorum threshold is met.

### `cancel(id)`

Called by the proposer. Cancels the grant and returns funds to the proposer. Only valid before execution.

### `getGrant(id)`

Returns full grant state: proposer, recipient, amount, description, reviewers, threshold, approval count, and status flags. Reverts with `"Grant does not exist"` if `id >= grantCount`.

### `getGrantIdsByReviewer(address)` / `getGrantIdsByProposer(address)`

Returns the list of grant IDs where the given address is a reviewer, or the proposer, respectively. Backs the backend's per-address listing endpoints.

### Validation

`createGrant` rejects a zero-address recipient, zero-address reviewers, and duplicate entries in the reviewer set.

## Backend API

Copy `backend/.env.example` to `backend/.env` to configure `RPC_URL` and `PORT` (both optional, defaults shown in the example file).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Service status and configured contract address |
| GET | `/api/count` | Total number of grants |
| GET | `/api/grants` | Paginated grant list (`?limit=` up to 100, default 20; `?offset=`) |
| GET | `/api/grants/:id` | Grant details by ID (404 if it doesn't exist) |
| GET | `/api/grants/:id/approved/:address` | Whether an address has approved a grant |
| GET | `/api/reviewers/:address/grants` | Full grant details for every grant where `address` is a reviewer |
| GET | `/api/proposers/:address/grants` | Full grant details for every grant proposed by `address` |

## Running Tests

```bash
cd contracts && npm test
```

```
  QuorumGrants
    ✔ creates a grant and stores it correctly
    ✔ executes when quorum is reached
    ✔ does not execute before quorum
    ✔ prevents double approval
    ✔ prevents non-reviewer from approving
    ✔ allows proposer to cancel and reclaims funds
    ✔ prevents approval after cancellation
    ✔ tracks hasApproved correctly
    ✔ requires funding on creation
    ✔ rejects invalid quorum threshold
    ✔ rejects a zero-address recipient
    ✔ rejects a zero-address reviewer
    ✔ rejects duplicate reviewers
    ✔ reverts on getGrant for a non-existent id
    ✔ reverts on hasApproved for a non-existent id
    ✔ reverts on approve for a non-existent id
    ✔ reverts on cancel for a non-existent id
    ✔ prevents approval after execution
    ✔ prevents cancellation after execution
    ✔ indexes grant ids by reviewer
    ✔ indexes grant ids by proposer
    ✔ returns an empty array for an address with no grants

  22 passing
```

## License

MIT
