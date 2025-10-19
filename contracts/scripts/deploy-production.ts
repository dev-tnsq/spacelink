// SPDX-License-Identifier: MIT
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Production Deployment Script for SpaceLink on Creditcoin
 *
 * Deploys all contracts in correct dependency order:
 * 1. Infrastructure (PriceOracleAggregator, TokenRegistry, OracleAggregator)
 * 2. Adapters (IPFS, Credit)
 * 3. Core contracts (Marketplace, Rewards)
 * 4. Extensions (BNPL, LiquidStaking, PassExchange)
 * 5. Configure permissions and initial settings
 */

interface DeploymentAddresses {
  priceOracleAggregator: string;
  tokenRegistry: string;
  oracleAggregator: string;
  paymentRouter: string;
  ipfsAdapter: string;
  creditcoinCreditAdapter: string;
  marketplace: string;
  rewards: string;
  bnplLoanManager: string;
  liquidStaking: string;
  passExchange: string;
  networkName: string;
  chainId: number;
  deployer: string;
  deployedAt: string;
}

async function main() {
  console.log("🚀 Starting SpaceLink Production Deployment on Creditcoin...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📍 Network:", network.name);
  console.log("🔗 Chain ID:", network.chainId);
  console.log("💰 Deployer:", deployer.address);
  console.log("💵 Balance:", ethers.utils.formatEther(await deployer.getBalance()), "CTC\n");

  // Deployment addresses object
  const addresses: DeploymentAddresses = {
    priceOracleAggregator: "",
    tokenRegistry: "",
    oracleAggregator: "",
    paymentRouter: "",
    ipfsAdapter: "",
    creditcoinCreditAdapter: "",
    marketplace: "",
    rewards: "",
    bnplLoanManager: "",
    liquidStaking: "",
    passExchange: "",
    networkName: network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  // ============ Step 1: Deploy PriceOracleAggregator ============
  console.log("🔮 Deploying PriceOracleAggregator...");

  // Get the prover contract address from environment or use a placeholder
  const proverContract = process.env.CREDITCOIN_PROVER_CONTRACT || "0x0000000000000000000000000000000000000000";

  const PriceOracleAggregator = await ethers.getContractFactory("PriceOracleAggregator");
  const priceOracleAggregator = await PriceOracleAggregator.deploy(proverContract);
  await priceOracleAggregator.deployed();
  addresses.priceOracleAggregator = priceOracleAggregator.address;

  console.log("✅ PriceOracleAggregator deployed to:", priceOracleAggregator.address);
  console.log("");

  // ============ Step 2: Deploy TokenRegistry ============
  console.log("📋 Deploying TokenRegistry...");

  const TokenRegistry = await ethers.getContractFactory("TokenRegistry");
  const tokenRegistry = await TokenRegistry.deploy(priceOracleAggregator.address);
  await tokenRegistry.deployed();
  addresses.tokenRegistry = tokenRegistry.address;

  console.log("✅ TokenRegistry deployed to:", tokenRegistry.address);
  console.log("");

  // ============ Step 3: Deploy OracleAggregator ============
  console.log("🔮 Deploying OracleAggregator...");

  const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
  const oracleAggregator = await OracleAggregator.deploy([deployer.address, deployer.address, deployer.address]); // 3 initial validators
  await oracleAggregator.deployed();
  addresses.oracleAggregator = oracleAggregator.address;

  console.log("✅ OracleAggregator deployed to:", oracleAggregator.address);
  console.log("");

  // ============ Step 4: Deploy PaymentRouter ============
  console.log("💱 Deploying PaymentRouter...");

  const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
  const paymentRouter = await PaymentRouter.deploy(tokenRegistry.address);
  await paymentRouter.deployed();
  addresses.paymentRouter = paymentRouter.address;

  console.log("✅ PaymentRouter deployed to:", paymentRouter.address);
  console.log("");

  // ============ Step 5: Deploy IPFSAdapter ============
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

  // ============ Step 5: Deploy CreditcoinCreditAdapter ============
  console.log("💳 Deploying CreditcoinCreditAdapter...");

  const CreditcoinCreditAdapter = await ethers.getContractFactory("CreditcoinCreditAdapter");
  const creditAdapter = await CreditcoinCreditAdapter.deploy();
  await creditAdapter.deployed();
  addresses.creditcoinCreditAdapter = creditAdapter.address;

  console.log("✅ CreditcoinCreditAdapter deployed to:", creditAdapter.address);
  console.log("");

  // ============ Step 6: Deploy Marketplace ============
  console.log("🏪 Deploying Marketplace...");

  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    oracleAggregator.address,
    paymentRouter.address,
    ipfsAdapter.address,
    creditAdapter.address
  );
  await marketplace.deployed();
  addresses.marketplace = marketplace.address;

  console.log("✅ Marketplace deployed to:", marketplace.address);
  console.log("");

  // ============ Step 7: Deploy Rewards ============
  console.log("🎁 Deploying Rewards...");

  const Rewards = await ethers.getContractFactory("Rewards");
  const rewards = await Rewards.deploy(
    marketplace.address,
    creditAdapter.address,
    ipfsAdapter.address,
    paymentRouter.address,
    ethers.constants.AddressZero // Default payout token (CTC)
  );
  await rewards.deployed();
  addresses.rewards = rewards.address;

  console.log("✅ Rewards deployed to:", rewards.address);
  console.log("");

  // ============ Step 8: Deploy BNPLLoanManager ============
  console.log("💰 Deploying BNPLLoanManager...");

  const BNPLLoanManager = await ethers.getContractFactory("BNPLLoanManager");
  const bnplManager = await BNPLLoanManager.deploy(
    creditAdapter.address,
    paymentRouter.address
  );
  await bnplManager.deployed();
  addresses.bnplLoanManager = bnplManager.address;

  console.log("✅ BNPLLoanManager deployed to:", bnplManager.address);
  console.log("");

  // ============ Step 9: Deploy LiquidStaking ============
  console.log("🏦 Deploying LiquidStaking...");

  const LiquidStaking = await ethers.getContractFactory("LiquidStaking");
  const liquidStaking = await LiquidStaking.deploy();
  await liquidStaking.deployed();
  addresses.liquidStaking = liquidStaking.address;

  console.log("✅ LiquidStaking deployed to:", liquidStaking.address);
  console.log("");

  // ============ Step 10: Deploy PassExchange ============
  console.log("� Deploying PassExchange...");

  const PassExchange = await ethers.getContractFactory("PassExchange");
  const passExchange = await PassExchange.deploy(
    marketplace.address,
    paymentRouter.address
  );
  await passExchange.deployed();
  addresses.passExchange = passExchange.address;

  console.log("✅ PassExchange deployed to:", passExchange.address);
  console.log("");

  // ============ Step 11: Configure Permissions ============
  console.log("🔐 Configuring permissions...");

  // Grant SCORE_MANAGER_ROLE to Rewards contract
  const SCORE_MANAGER_ROLE = ethers.utils.id("SCORE_MANAGER_ROLE");
  await creditAdapter.grantRole(SCORE_MANAGER_ROLE, rewards.address);
  console.log("  - Granted SCORE_MANAGER_ROLE to Rewards");

  // Grant SCORE_MANAGER_ROLE to Marketplace contract
  await creditAdapter.grantRole(SCORE_MANAGER_ROLE, marketplace.address);
  console.log("  - Granted SCORE_MANAGER_ROLE to Marketplace");

  // Grant SCORE_MANAGER_ROLE to BNPLLoanManager
  await creditAdapter.grantRole(SCORE_MANAGER_ROLE, bnplManager.address);
  console.log("  - Granted SCORE_MANAGER_ROLE to BNPLLoanManager");

  // Grant PENALTY_MANAGER_ROLE to Marketplace contract
  const PENALTY_MANAGER_ROLE = ethers.utils.id("PENALTY_MANAGER_ROLE");
  await creditAdapter.grantRole(PENALTY_MANAGER_ROLE, marketplace.address);
  console.log("  - Granted PENALTY_MANAGER_ROLE to Marketplace");
  console.log("");

  // ============ Step 12: Initial Configuration ============
  console.log("⚙️  Initial configuration...");

  // Add CTC as supported token in TokenRegistry
  const CTC_ADDRESS = "0x0000000000000000000000000000000000000001"; // Native CTC
  await tokenRegistry.addToken(CTC_ADDRESS, "CTC", "Creditcoin", 18, ethers.utils.parseEther("1"));
  console.log("  - Added CTC as supported token");

  // Configure CTC in PriceOracleAggregator (fixed price)
  await priceOracleAggregator.addToken(CTC_ADDRESS, 1024, CTC_ADDRESS, 100); // Creditcoin mainnet chain ID
  console.log("  - Configured CTC in price oracle");

  // Set CTC as supported for payments
  await tokenRegistry.setTokenSupported(CTC_ADDRESS, true);
  console.log("  - Enabled CTC for payments");

  // Add Uniswap V3 router to PaymentRouter (placeholder for Creditcoin)
  const UNISWAP_ROUTER = "0x0000000000000000000000000000000000000002"; // Placeholder
  await paymentRouter.setDexRouter(UNISWAP_ROUTER);
  console.log("  - Set DEX router (placeholder)");
  console.log("");

  // ============ Step 13: Save Deployment Addresses ============
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
  console.log("=".repeat(60));
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(60));
  console.log("");
  console.log("📋 Contract Addresses:");
  console.log("  PriceOracleAggregator:", addresses.priceOracleAggregator);
  console.log("  TokenRegistry:", addresses.tokenRegistry);
  console.log("  OracleAggregator:", addresses.oracleAggregator);
  console.log("  PaymentRouter:", addresses.paymentRouter);
  console.log("  IPFSAdapter:", addresses.ipfsAdapter);
  console.log("  CreditcoinCreditAdapter:", addresses.creditcoinCreditAdapter);
  console.log("  Marketplace:", addresses.marketplace);
  console.log("  Rewards:", addresses.rewards);
  console.log("  BNPLLoanManager:", addresses.bnplLoanManager);
  console.log("  LiquidStaking:", addresses.liquidStaking);
  console.log("  PassExchange:", addresses.passExchange);
  console.log("");
  console.log("💡 Next Steps:");
  console.log("  1. Verify contracts on Creditcoin explorer");
  console.log("  2. Set up Gnosis Safe multi-sig for oracle validators");
  console.log("  3. Configure IPFS pinning service (Pinata/Infura)");
  console.log("  4. Add real token addresses and price feeds");
  console.log("  5. Set up DEX router for token swaps");
  console.log("  6. Run integration tests");
  console.log("");
  console.log("📝 Deployment saved to: deployments/");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
