# 🛰️ SpaceLink - Complete Production System Documentation

## Overview

SpaceLink is a fully decentralized ground station network that connects satellite operators with ground station operators using blockchain technology, credit scoring, and decentralized storage.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend (Next.js)                      │
│                    Users, Ground Stations, Operators             │
└───────────────────┬─────────────────────┬───────────────────────┘
                    │                     │
                    ▼                     ▼
          ┌──────────────────┐  ┌──────────────────┐
          │   IPFS Network   │  │  Smart Contracts │
          │  (Pinata/Infura) │  │   (Creditcoin)   │
          └──────────────────┘  └─────────┬────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
          ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
          │  Chainlink DON   │  │  IPFS Adapter    │  │  Credit Adapter  │
          │ (TLE + Proofs)   │  │  (CID Registry)  │  │  (Scoring)       │
          └──────────────────┘  └──────────────────┘  └──────────────────┘
```

## 📦 Deployed Contracts

### Production Adapters

1. **ChainlinkOracleAdapter**
   - Verifies satellite relay proofs using Chainlink Functions
   - Validates TLE (Two-Line Element) orbital data
   - Off-chain computation with on-chain results

2. **IPFSAdapter**
   - On-chain CID registry
   - Tracks who uploaded what
   - Gateway configuration for downloads

3. **CreditcoinCreditAdapter**
   - On-chain credit scoring (0-1000 points)
   - +10 points per successful relay
   - BNPL eligibility: 650 points = $500, 1000 points = $1500
   - Role-based access control

### Core Contracts

4. **Marketplace**
   - Node (ground station) registration
   - Satellite registration with TLE
   - Pass booking and completion
   - Proof submission and verification

5. **Rewards**
   - Distributes 1 CTC per relay
   - Awards +10 credit points
   - Integrates with credit adapter

6. **CreditHook**
   - Credit score management
   - BNPL eligibility checks
   - Authorized caller system

## 🚀 Deployment Guide

### Prerequisites

```bash
# Install dependencies
cd contracts
npm install

# Set up environment
cp .env.example .env
# Edit .env with your private key and RPC URL
```

### Deploy to Creditcoin Testnet

```bash
# Compile contracts
npx hardhat compile

# Deploy production system
npx hardhat run scripts/deploy-production.ts --network creditcoinTestnet

# Deployment will output addresses to deployments/ folder
```

### What Gets Deployed:

1. ✅ ChainlinkOracleAdapter (with placeholder router for testnet)
2. ✅ IPFSAdapter (configured with IPFS gateway)
3. ✅ CreditcoinCreditAdapter (with role-based permissions)
4. ✅ Marketplace (connected to all adapters)
5. ✅ Rewards (funded with 100 CTC)
6. ✅ CreditHook (authorized callers configured)

## 📡 IPFS Integration

### How IPFS Works in SpaceLink:

1. **Frontend uploads files** to IPFS (via Pinata/Infura/local node)
2. **IPFS returns a CID** (Content Identifier like `QmX...` or `bafybei...`)
3. **Smart contract stores CID** on-chain in IPFSAdapter
4. **Anyone can download** using CID from IPFS gateway

### Upload Example (Frontend):

```typescript
// Using Pinata SDK
import { PinataSDK } from "pinata-web3";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: "your-gateway.mypinata.cloud"
});

// Upload file
const file = new File(["Ground station specs..."], "station-specs.json");
const upload = await pinata.upload.file(file);
console.log("CID:", upload.IpfsHash); // QmX...

// Register with smart contract
await marketplace.registerNode(
  lat,
  lon,
  specs,
  uptime,
  upload.IpfsHash // Pass CID to smart contract
);
```

### Download Example (Frontend):

```typescript
// Download from IPFS
const cid = "QmX..."; // From smart contract
const url = `https://ipfs.io/ipfs/${cid}`;
const response = await fetch(url);
const data = await response.json();
```

### Pinata Setup:

1. Sign up at https://pinata.cloud
2. Get API Key (JWT)
3. Set in `.env`:
   ```
   PINATA_JWT=your_jwt_here
   PINATA_GATEWAY=your-gateway.mypinata.cloud
   ```

### Infura Setup (Alternative):

1. Sign up at https://infura.io
2. Create IPFS project
3. Get Project ID and Secret
4. Use in frontend:
   ```typescript
   const auth = 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');
   const response = await fetch('https://ipfs.infura.io:5001/api/v0/add', {
     method: 'POST',
     headers: { Authorization: auth },
     body: formData
   });
   ```

## 🔗 Chainlink Functions Integration

### How It Works:

1. User completes relay → calls `marketplace.completePass(proofHash)`
2. Marketplace calls `chainlinkOracle.verifyProof()`
3. ChainlinkOracleAdapter sends request to Chainlink DON
4. DON executes JavaScript (tle-validator.js or proof-verifier.js)
5. Result returns to smart contract via `fulfillRequest()` callback
6. User can claim rewards if verified

### JavaScript Source Files:

Located in `chainlink-functions/`:

- **tle-validator.js**: Validates TLE format, checksums, and freshness
- **proof-verifier.js**: Verifies relay proofs with timing and signatures

### Setting Up Chainlink (Production):

1. Go to https://functions.chain.link
2. Create subscription
3. Fund subscription with LINK
4. Add consumer contract (ChainlinkOracleAdapter address)
5. Update deployment script with:
   - Router address
   - DON ID
   - Subscription ID

### Testnet Usage:

For Creditcoin testnet (no Chainlink yet), we use placeholder addresses. The contract is ready, but verification happens when Chainlink is available.

## 💳 Credit Scoring System

### How It Works:

- **Initial Score**: 600 points (neutral)
- **Per Relay**: +10 points
- **Per Failure**: -50 points
- **Time Bonus**: +25 points per month of good standing
- **BNPL Eligibility**:
  - 650 points = $500 credit line
  - 1000 points = $1500 credit line
  - Linear scaling between

### Credit Flow:

```typescript
// After successful relay
rewards.claimReward(passId);
// → Transfers 1 CTC
// → Calls creditAdapter.recordRelayCompletion(user)
// → Adds +10 points to user's score
// → Emits CreditScoreIncreased event

// Check BNPL eligibility
const maxLoan = await creditAdapter.getMaxLoanAmount(userAddress);
console.log("Max BNPL:", ethers.utils.formatEther(maxLoan), "CTC");
```

### Role-Based Permissions:

- **SCORE_MANAGER_ROLE**: Can increase scores (Rewards, Marketplace)
- **PENALTY_MANAGER_ROLE**: Can decrease scores (Marketplace)
- **DEFAULT_ADMIN_ROLE**: Can manage roles (Deployer)

## 🛰️ Satellite Communication Flow

### Complete Process:

1. **Satellite Operator Registers Satellite**:
   ```typescript
   await marketplace.registerSatellite(
     tle1: "1 25544U 98067A   24001.50000000 ...",
     tle2: "2 25544  51.6400 123.4567 ...",
     ipfsCID: "QmSatelliteMetadata..."
   );
   ```

2. **Ground Station Operator Registers Node**:
   ```typescript
   await marketplace.registerNode(
     lat: 404583,  // 40.4583° * 10000
     lon: -739583, // -73.9583° (New York) * 10000
     specs: "S-band, 2.4GHz, 10m dish",
     uptime: 95,
     ipfsCID: "QmStationPhoto...",
     { value: ethers.utils.parseEther("1") } // 1 CTC stake
   );
   ```

3. **Satellite Operator Books Pass**:
   ```typescript
   await marketplace.bookPass(
     nodeId: 1,
     satId: 42,
     timestamp: 1728691200, // Unix timestamp
     durationMin: 8,
     { value: paymentAmount }
   );
   ```

4. **Ground Station Receives Data**:
   - Physical communication happens (radio)
   - Operator generates proof hash:
     ```typescript
     const proofHash = ethers.utils.keccak256(
       ethers.utils.defaultAbiCoder.encode(
         ['bytes', 'uint256', 'bytes', 'bytes'],
         [receivedData, timestamp, nodeSignature, satSignature]
       )
     );
     ```

5. **Submit Proof**:
   ```typescript
   await marketplace.completePass(passId, proofHash);
   ```

6. **Chainlink Verifies** (off-chain):
   - Checks proof authenticity
   - Validates timing
   - Confirms TLE was current

7. **Claim Rewards**:
   ```typescript
   await rewards.claimReward(passId);
   // → 1 CTC transferred
   // → +10 credit points awarded
   ```

## 🧪 Testing

```bash
# Run all tests
npx hardhat test

# Run specific test
npx hardhat test test/Marketplace.test.ts

# With gas reporting
REPORT_GAS=true npx hardhat test
```

## 📊 Gas Optimization

Target: **~$0.001 per transaction** on Creditcoin

Optimizations implemented:
- ✅ viaIR compiler optimization
- ✅ Struct packing
- ✅ Minimal storage reads/writes
- ✅ Event indexing for filtering
- ✅ OpenZeppelin gas-efficient patterns

## 🔐 Security Features

- ✅ ReentrancyGuard on all payment functions
- ✅ Pausable for emergency stops
- ✅ Access control with roles
- ✅ Input validation library
- ✅ Emergency withdrawal (owner only, when paused)
- ✅ Ownable with transferOwnership

## 📝 Contract Addresses

After deployment, addresses are saved to:
```
deployments/deployment-creditcoinTestnet-latest.json
```

Example:
```json
{
  "chainlinkOracleAdapter": "0x...",
  "ipfsAdapter": "0x...",
  "creditcoinCreditAdapter": "0x...",
  "marketplace": "0x...",
  "rewards": "0x...",
  "creditHook": "0x...",
  "networkName": "creditcoinTestnet",
  "chainId": 102031,
  "deployer": "0x...",
  "deployedAt": "2025-10-13T..."
}
```

## 🎯 Next Steps

1. ✅ Smart contracts deployed
2. ✅ Adapters configured
3. ⏳ Set up Chainlink Functions subscription (when available on Creditcoin)
4. ⏳ Configure IPFS pinning service (Pinata/Infura)
5. ⏳ Build frontend with Next.js
6. ⏳ Integrate wallet connection (MetaMask)
7. ⏳ Create ground station operator dashboard
8. ⏳ Implement satellite pass prediction (using satellite.js)
9. ⏳ Add real-time relay monitoring
10. ⏳ Deploy to production

## 📚 Additional Resources

- Creditcoin Docs: https://docs.creditcoin.org
- Chainlink Functions: https://docs.chain.link/chainlink-functions
- IPFS Docs: https://docs.ipfs.tech
- Pinata Docs: https://docs.pinata.cloud
- Satellite.js: https://github.com/shashwatak/satellite-js

## 🤝 Support

For questions or issues:
- GitHub Issues: [Your repo]
- Discord: [Your server]
- Email: [Your email]

---

**Built with ❤️ for the decentralized space economy**
