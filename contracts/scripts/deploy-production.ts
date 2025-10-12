import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Production Deployment Script for SpaceLink
 * 
 * Deploys all contracts in correct order:
 * 1. Production adapters (Chainlink, IPFS, Credit)
 * 2. Core contracts (Marketplace, Rewards, CreditHook)
 * 3. Configure permissions and settings
 * 4. Save deployment addresses
 */

interface DeploymentAddresses {
  chainlinkOracleAdapter: string;
  ipfsAdapter: string;
  creditcoinCreditAdapter: string;
  marketplace: string;
  rewards: string;
  creditHook: string;
  networkName: string;
  chainId: number;
  deployer: string;
  deployedAt: string;
}

async function main() {
  console.log("🚀 Starting SpaceLink Production Deployment...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📍 Network:", network.name);
  console.log("🔗 Chain ID:", network.chainId);
  console.log("💰 Deployer:", deployer.address);
  console.log("💵 Balance:", ethers.utils.formatEther(await deployer.getBalance()), "CTC\n");

  // Deployment addresses object
  const addresses: DeploymentAddresses = {
    chainlinkOracleAdapter: "",
    ipfsAdapter: "",
    creditcoinCreditAdapter: "",
    marketplace: "",
    rewards: "",
    creditHook: "",
    networkName: network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  // ============ Step 1: Deploy ChainlinkOracleAdapter ============
  console.log("📡 Deploying ChainlinkOracleAdapter...");
  
  // Creditcoin testnet doesn't have Chainlink yet, so we'll use mock for now
  // In production on mainnet, use actual Chainlink Functions router
  const ChainlinkOracleAdapter = await ethers.getContractFactory("ChainlinkOracleAdapter");
  
  // For testnet: Use placeholder addresses
  // For mainnet: Replace with actual Chainlink Functions router and DON ID
  const CHAINLINK_ROUTER = "0x0000000000000000000000000000000000000001"; // Placeholder
  const DON_ID = "0x66756e2d706f6c79676f6e2d6d756d6261692d31000000000000000000000000"; // Placeholder
  const SUBSCRIPTION_ID = 1; // Placeholder
  const CALLBACK_GAS_LIMIT = 300000; // 300k gas limit for callbacks
  
  const chainlinkOracle = await ChainlinkOracleAdapter.deploy(
    CHAINLINK_ROUTER,
    DON_ID,
    SUBSCRIPTION_ID,
    CALLBACK_GAS_LIMIT
  );
  await chainlinkOracle.deployed();
  addresses.chainlinkOracleAdapter = chainlinkOracle.address;
  
  console.log("✅ ChainlinkOracleAdapter deployed to:", chainlinkOracle.address);
  console.log("");

  // ============ Step 2: Deploy IPFSAdapter ============
  console.log("📦 Deploying IPFSAdapter...");
  
  const IPFSAdapter = await ethers.getContractFactory("IPFSAdapter");
  const ipfsAdapter = await IPFSAdapter.deploy();
  await ipfsAdapter.deployed();
  addresses.ipfsAdapter = ipfsAdapter.address;
  
  console.log("✅ IPFSAdapter deployed to:", ipfsAdapter.address);
  
  // Configure IPFS gateways
  console.log("⚙️  Configuring IPFS gateways...");
  const IPFS_GATEWAY = "https://ipfs.io";
  
  await ipfsAdapter.updateGateway(IPFS_GATEWAY);
  console.log("  - IPFS gateway set to:", IPFS_GATEWAY);
  console.log("");

  // ============ Step 3: Deploy CreditcoinCreditAdapter ============
  console.log("💳 Deploying CreditcoinCreditAdapter...");
  
  const CreditcoinCreditAdapter = await ethers.getContractFactory("CreditcoinCreditAdapter");
  const creditAdapter = await CreditcoinCreditAdapter.deploy();
  await creditAdapter.deployed();
  addresses.creditcoinCreditAdapter = creditAdapter.address;
  
  console.log("✅ CreditcoinCreditAdapter deployed to:", creditAdapter.address);
  console.log("");

  // ============ Step 4: Deploy Marketplace ============
  console.log("🏪 Deploying Marketplace...");
  
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    chainlinkOracle.address,
    ipfsAdapter.address,
    creditAdapter.address
  );
  await marketplace.deployed();
  addresses.marketplace = marketplace.address;
  
  console.log("✅ Marketplace deployed to:", marketplace.address);
  console.log("");

  // ============ Step 5: Deploy Rewards ============
  console.log("🎁 Deploying Rewards...");
  
  const Rewards = await ethers.getContractFactory("Rewards");
  const rewards = await Rewards.deploy(
    marketplace.address,
    creditAdapter.address,
    ipfsAdapter.address
  );
  await rewards.deployed();
  addresses.rewards = rewards.address;
  
  console.log("✅ Rewards deployed to:", rewards.address);
  
  // Fund rewards pool with initial amount
  console.log("💰 Funding rewards pool...");
  const INITIAL_REWARDS_POOL = ethers.utils.parseEther("100"); // 100 CTC
  await deployer.sendTransaction({
    to: rewards.address,
    value: INITIAL_REWARDS_POOL,
  });
  console.log("  - Funded with:", ethers.utils.formatEther(INITIAL_REWARDS_POOL), "CTC");
  console.log("");

  // ============ Step 6: Deploy CreditHook ============
  console.log("🔗 Deploying CreditHook...");
  
  const CreditHook = await ethers.getContractFactory("CreditHook");
  const creditHook = await CreditHook.deploy(creditAdapter.address);
  await creditHook.deployed();
  addresses.creditHook = creditHook.address;
  
  console.log("✅ CreditHook deployed to:", creditHook.address);
  console.log("");

  // ============ Step 7: Configure Permissions ============
  console.log("🔐 Configuring permissions...");
  
  // Grant SCORE_MANAGER_ROLE to Rewards contract
  const SCORE_MANAGER_ROLE = ethers.utils.id("SCORE_MANAGER_ROLE");
  await creditAdapter.grantRole(SCORE_MANAGER_ROLE, rewards.address);
  console.log("  - Granted SCORE_MANAGER_ROLE to Rewards");
  
  // Grant SCORE_MANAGER_ROLE to Marketplace contract
  await creditAdapter.grantRole(SCORE_MANAGER_ROLE, marketplace.address);
  console.log("  - Granted SCORE_MANAGER_ROLE to Marketplace");
  
  // Grant PENALTY_MANAGER_ROLE to Marketplace contract
  const PENALTY_MANAGER_ROLE = ethers.utils.id("PENALTY_MANAGER_ROLE");
  await creditAdapter.grantRole(PENALTY_MANAGER_ROLE, marketplace.address);
  console.log("  - Granted PENALTY_MANAGER_ROLE to Marketplace");
  
  // Authorize Rewards contract in CreditHook
  await creditHook.setAuthorizedCaller(rewards.address, true);
  console.log("  - Authorized Rewards in CreditHook");
  
  // Authorize Marketplace contract in CreditHook
  await creditHook.setAuthorizedCaller(marketplace.address, true);
  console.log("  - Authorized Marketplace in CreditHook");
  console.log("");

  // ============ Step 8: Save Deployment Addresses ============
  console.log("💾 Saving deployment addresses...");
  
  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `deployment-${network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(addresses, null, 2));
  console.log("✅ Deployment addresses saved to:", filename);
  
  // Also save as latest
  const latestPath = path.join(deploymentsDir, `deployment-${network.name}-latest.json`);
  fs.writeFileSync(latestPath, JSON.stringify(addresses, null, 2));
  console.log("✅ Latest deployment saved");
  console.log("");

  // ============ Deployment Summary ============
  console.log("=" .repeat(60));
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=" .repeat(60));
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log("  ChainlinkOracleAdapter:", addresses.chainlinkOracleAdapter);
  console.log("  IPFSAdapter:", addresses.ipfsAdapter);
  console.log("  CreditcoinCreditAdapter:", addresses.creditcoinCreditAdapter);
  console.log("  Marketplace:", addresses.marketplace);
  console.log("  Rewards:", addresses.rewards);
  console.log("  CreditHook:", addresses.creditHook);
  console.log("");
  console.log("💡 Next Steps:");
  console.log("  1. Verify contracts on block explorer");
  console.log("  2. Set up Chainlink Functions subscription (if not using mock)");
  console.log("  3. Configure IPFS pinning service (Pinata/Infura)");
  console.log("  4. Update frontend with contract addresses");
  console.log("  5. Run integration tests");
  console.log("");
  console.log("📝 Deployment saved to: deployments/");
  console.log("=" .repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
