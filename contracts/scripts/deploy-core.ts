// SPDX-License-Identifier: MIT
import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying PriceOracleAggregator and TokenRegistry...\n");

  const [deployer] = await ethers.getSigners();
  console.log("💰 Deployer:", deployer.address);
  console.log("💵 Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

  // Deploy PriceOracleAggregator (without prover for basic functionality)
  console.log("🔮 Deploying PriceOracleAggregator...");
  const PriceOracleAggregator = await ethers.getContractFactory("PriceOracleAggregator");
  const priceOracleAggregator = await PriceOracleAggregator.deploy(ethers.constants.AddressZero);
  await priceOracleAggregator.deployed();
  console.log("✅ PriceOracleAggregator deployed to:", priceOracleAggregator.address);

  // Deploy TokenRegistry
  console.log("📋 Deploying TokenRegistry...");
  const TokenRegistry = await ethers.getContractFactory("TokenRegistry");
  const tokenRegistry = await TokenRegistry.deploy(priceOracleAggregator.address);
  await tokenRegistry.deployed();
  console.log("✅ TokenRegistry deployed to:", tokenRegistry.address);

  console.log("\n🎉 Deployment completed successfully!");
  console.log("📋 Summary:");
  console.log("   PriceOracleAggregator:", priceOracleAggregator.address);
  console.log("   TokenRegistry:", tokenRegistry.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});