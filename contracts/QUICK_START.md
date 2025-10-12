# ⚡ SpaceLink Contracts - Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Fix Node.js Version (Required)
```bash
# Install Node v22 (Hardhat compatible)
nvm install 22
nvm use 22
node --version  # Should show v22.x.x
```

### 2. Install Dependencies
```bash
cd /Users/tanishqmaheshwari/code/blockchain/spacelink/contracts
npm install
```

### 3. Compile Contracts
```bash
npx hardhat compile
```

Expected output:
```
Compiled 15 Solidity files successfully
```

### 4. Run Tests
```bash
npx hardhat test
```

### 5. Get Testnet CTC
Visit: https://faucet.creditcoin.org
- Connect wallet
- Get 10 CTC
- Wait ~30 seconds

### 6. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your private key:
# PRIVATE_KEY=0xYOUR_KEY_HERE
```

### 7. Deploy to Testnet
```bash
npx hardhat run scripts/deploy.ts --network creditcoinTestnet
```

Expected output:
```
🚀 Starting SpaceLink deployment...
📍 Deploying with account: 0x...
💰 Account balance: 10000000000000000000

📦 Step 1: Deploying mock contracts...
✅ MockChainlinkOracle deployed to: 0x...
✅ MockWalrus deployed to: 0x...
✅ MockCreditModule deployed to: 0x...

📦 Step 2: Deploying core contracts...
✅ Marketplace deployed to: 0x...
✅ CreditHook deployed to: 0x...
✅ Rewards deployed to: 0x...

⚙️  Step 3: Configuring contracts...
✅ Authorized Rewards contract in CreditHook
✅ Funded Rewards pool with 10 CTC

🎉 Deployment completed successfully!
```

### 8. Verify Deployment
Check `deployments.json` for all contract addresses.

## 📋 What You Just Deployed

1. **Marketplace** - Register nodes, satellites, book passes
2. **Rewards** - Distribute 1 CTC + credit points
3. **CreditHook** - Manage credit scores for BNPL
4. **Mocks** - Oracle, Storage, Credit Module (for testing)

## 🧪 Test Contracts

### Register a Test Node (MetaMask/Ethers.js)
```javascript
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://rpc.testnet.creditcoin.org:8545");
const signer = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
const marketplace = new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, signer);

const tx = await marketplace.registerNode(
  140583,                      // Bangalore lat (14.0583°)
  777093,                      // Bangalore lon (77.7093°)
  "S-band, 100 Mbps",         // Hardware specs
  98,                          // 98% uptime
  { value: ethers.parseEther("1") }  // 1 CTC stake
);

await tx.wait();
console.log("Node registered! Node ID: 1");
```

### Book a Test Pass
```javascript
const tx = await marketplace.bookPass(
  1,                          // nodeId
  1,                          // satId (register satellite first)
  7,                          // 7 minutes duration
  { value: ethers.parseEther("1") }  // 1 CTC payment
);

await tx.wait();
console.log("Pass booked! Pass ID: 1");
```

## 🔍 View on Explorer

After deployment, view contracts on:
**https://explorer.testnet.creditcoin.org**

Search for your contract addresses from `deployments.json`.

## 🐛 Troubleshooting

### "Node.js not supported"
```bash
nvm use 22  # Switch to Node v22
```

### "Insufficient funds"
```bash
# Get more CTC from faucet
open https://faucet.creditcoin.org
```

### "Cannot find module"
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### "Invalid nonce"
```bash
# Reset MetaMask nonce in Advanced Settings
# Or wait 30 seconds and retry
```

## 📚 Next Steps

1. ✅ Deploy contracts
2. 🔄 Register 5 test nodes (different locations)
3. 🔄 Register 2 test satellites (ISS, Starlink TLEs)
4. 🔄 Book passes and test relay flow
5. 🔄 Claim rewards and verify credit boost
6. 🔄 Check BNPL eligibility at different scores
7. 🔄 Build frontend integration (Next.js + Cesium.js)

## 🤝 Need Help?

- Check **CONTRACT_README.md** for detailed docs
- Read **IMPLEMENTATION_SUMMARY.md** for complete overview
- Review test files in `test/` for examples
- Hardhat docs: https://hardhat.org
- Creditcoin docs: https://docs.creditcoin.org

---

**You're ready to launch! 🚀**
