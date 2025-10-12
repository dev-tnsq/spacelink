# SpaceLink Smart Contracts

Complete Solidity contracts for the SpaceLink decentralized satellite relay marketplace on Creditcoin blockchain.

## 🏗️ Architecture

### Core Contracts
- **Marketplace.sol** - Main marketplace for node/satellite registration and pass bookings
- **Rewards.sol** - Handles reward distribution (1 CTC per relay + credit boost)
- **CreditHook.sol** - Integration with Creditcoin's credit module for BNPL financing

### Interfaces
- **IChainlinkOracle.sol** - Oracle interface for proof verification
- **IWalrus.sol** - Decentralized storage interface for metadata/proofs
- **ICreditModule.sol** - Credit scoring and BNPL eligibility interface

### Libraries
- **ValidationLibrary.sol** - Input validation helpers (coordinates, TLE, duration, etc.)

### Mock Contracts (MVP Testing)
- **MockChainlinkOracle.sol** - Test oracle implementation
- **MockWalrus.sol** - Test storage implementation
- **MockCreditModule.sol** - Test credit module implementation

## 🚀 Quick Start

### Prerequisites
```bash
node >= 18.0.0
npm >= 9.0.0
```

### Installation
```bash
cd contracts
npm install
```

### Configuration
Create `.env` file:
```bash
cp .env.example .env
# Add your private key for deployment
```

### Compile Contracts
```bash
npx hardhat compile
```

### Run Tests
```bash
npx hardhat test
```

### Deploy to Creditcoin Testnet
```bash
# Get testnet CTC from faucet: https://faucet.creditcoin.org
npx hardhat run scripts/deploy.ts --network creditcoinTestnet
```

## 📋 Contract Details

### Marketplace.sol
Main contract managing the relay marketplace.

**Key Functions:**
- `registerNode(lat, lon, specs, uptime)` - Register ground station (1 CTC stake)
- `registerSatellite(tle1, tle2)` - Register satellite (1 CTC stake)
- `bookPass(nodeId, satId, duration)` - Book relay pass (1 CTC payment)
- `completePass(passId, proofHash)` - Submit relay proof (node owner only)

**Events:**
- `NodeRegistered(nodeId, owner, lat, lon, specs, walrusCID)`
- `SatelliteRegistered(satId, owner, tle1, tle2, walrusCID)`
- `PassBooked(passId, operator, nodeId, satId, timestamp, duration)`
- `PassCompleted(passId, node, proofHash)`
- `PassVerified(passId, verified)`

### Rewards.sol
Handles reward distribution and credit score updates.

**Key Functions:**
- `claimReward(passId)` - Claim 1 CTC reward after verified relay
- `distributeReward(passId, nodeOwner)` - Marketplace auto-distribution
- `fundRewards()` - Add CTC to rewards pool

**Mechanics:**
- 1 CTC per completed relay
- +10 credit points per relay
- Logs to Walrus for audits
- Scales to $10M TVL

### CreditHook.sol
Credit score management and BNPL eligibility checking.

**Key Functions:**
- `boostCredit(user, points)` - Increase credit score (authorized only)
- `checkBNPLEligibility(user, amount)` - Check loan eligibility
- `projectCreditGrowth(user, numRelays)` - Project future score
- `batchBoostCredit(users, points)` - Bulk credit updates

**Credit Scoring:**
- Score range: 0-1000
- +10 points per relay
- Min BNPL score: 650 (qualifies for $500)
- Max loan at 1000 score: $1500
- Linear scaling formula

## 🔧 Network Configuration

### Creditcoin Testnet
- **RPC:** https://rpc.testnet.creditcoin.org:8545
- **Chain ID:** 102031
- **Faucet:** https://faucet.creditcoin.org
- **Explorer:** https://explorer.testnet.creditcoin.org

### Gas Optimization
- Solidity 0.8.20 with optimizer (200 runs)
- Average tx cost: ~$0.001 on testnet
- Batch operations for scaling

## 📝 Usage Examples

### Register a Node
```javascript
const tx = await marketplace.registerNode(
  140583,           // lat (14.0583° scaled)
  777093,           // lon (77.7093° scaled)
  "S-band, 100 Mbps", // specs
  98,               // uptime %
  { value: ethers.parseEther("1") } // 1 CTC stake
);
```

### Book a Pass
```javascript
const tx = await marketplace.bookPass(
  1,                // nodeId
  1,                // satId
  7,                // duration (minutes)
  { value: ethers.parseEther("1") } // 1 CTC payment
);
```

### Complete Relay
```javascript
const proofHash = ethers.keccak256(relayData);
const tx = await marketplace.completePass(passId, proofHash);
```

### Claim Reward
```javascript
const tx = await rewards.claimReward(passId);
// Receives 1 CTC + 10 credit points
```

## 🧪 Testing

Run full test suite:
```bash
npx hardhat test
```

Run specific test:
```bash
npx hardhat test test/Marketplace.test.ts
```

Coverage report:
```bash
npx hardhat coverage
```

## 🔐 Security

- OpenZeppelin contracts for security
- ReentrancyGuard on all payable functions
- Pausable for emergency stops
- Ownable for admin functions
- Input validation library
- Tested on testnet before mainnet

## 📊 Deployment Info

After deployment, contract addresses are saved to `deployments.json`:
```json
{
  "network": "creditcoinTestnet",
  "deployer": "0x...",
  "timestamp": "2025-10-12T...",
  "contracts": {
    "marketplace": "0x...",
    "rewards": "0x...",
    "creditHook": "0x..."
  }
}
```

## 🛠️ Development

### Project Structure
```
contracts/
├── contracts/
│   ├── Marketplace.sol          # Main marketplace
│   ├── Rewards.sol              # Reward distribution
│   ├── CreditHook.sol           # Credit integration
│   ├── interfaces/              # Contract interfaces
│   ├── libraries/               # Helper libraries
│   └── mocks/                   # Test mocks
├── scripts/
│   └── deploy.ts                # Deployment script
├── test/                        # Test files
├── ignition/modules/            # Hardhat Ignition
└── hardhat.config.ts            # Configuration
```

### Add Production Oracles
Replace mock contracts with:
- Chainlink DON for verification
- Walrus SDK integration
- Creditcoin Credit Module

## 📚 Additional Resources

- [Creditcoin Docs](https://docs.creditcoin.org)
- [Hardhat Docs](https://hardhat.org)
- [OpenZeppelin](https://docs.openzeppelin.com)
- [Chainlink](https://docs.chain.link)

## 🤝 Contributing

1. Fork the repo
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📄 License

UNLICENSED - Proprietary SpaceLink technology

## 🚀 Next Steps

1. ✅ Compile contracts
2. ✅ Deploy to testnet
3. 🔄 Register test nodes
4. 🔄 Book test passes
5. 🔄 Verify rewards flow
6. 🔄 Production deployment

---

**Built for SpaceLink** - Making satellite communication accessible to all 🛰️
