// SPDX-License-Identifier: MIT
import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying updated Marketplace contract...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("📍 Network:", network.name);
  console.log("🔗 Chain ID:", network.chainId);
  console.log("💰 Deployer:", deployer.address);
  console.log("💵 Balance:", ethers.utils.formatEther(await deployer.getBalance()), "CTC\n");

  // Use existing dependency addresses
  const ORACLE_ADDRESS = "0xB56c32C53ffdDEF7d4544683a91cCCdf5C4fAb98";
  const IPFS_ADDRESS = "0xD7fcF6cf23b00829Fd64F1956Ad0227a11DB0A01";
  const CREDIT_MODULE_ADDRESS = "0xc1fD511958459DeF65445124e702a2Ff3537f090";
  const PAYMENT_ROUTER_ADDRESS = "0xbd6737Ec181c402243B700DEE28FBd48f425758f";

  console.log("🔗 Using dependency addresses:");
  console.log("   Oracle:", ORACLE_ADDRESS);
  console.log("   IPFS:", IPFS_ADDRESS);
  console.log("   Credit Module:", CREDIT_MODULE_ADDRESS);
  console.log("   Payment Router:", PAYMENT_ROUTER_ADDRESS);
  console.log("");

  // Deploy Marketplace
  console.log("🏪 Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(
    ORACLE_ADDRESS,
    IPFS_ADDRESS,
    CREDIT_MODULE_ADDRESS,
    PAYMENT_ROUTER_ADDRESS
  );

  await marketplace.deployed();
  console.log("✅ Marketplace deployed to:", marketplace.address);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const nodeCount = await marketplace.nodeCount();
  const satelliteCount = await marketplace.satelliteCount();
  const passCount = await marketplace.passCount();

  console.log("📊 Contract state:");
  console.log("   Node count:", nodeCount.toString());
  console.log("   Satellite count:", satelliteCount.toString());
  console.log("   Pass count:", passCount.toString());

  console.log("\n🎉 Marketplace deployment completed successfully!");
  console.log("📋 New Marketplace Address:", marketplace.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});