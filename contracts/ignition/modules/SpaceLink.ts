import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * SpaceLink Deployment Module
 * Deploys all contracts in correct order with dependencies
 */
const SpaceLinkModule = buildModule("SpaceLinkModule", (m:any) => {
  // ============ Step 1: Deploy Mock Contracts (MVP Phase) ============
  
  const mockOracle = m.contract("MockChainlinkOracle");
  const mockWalrus = m.contract("MockWalrus");
  const mockCreditModule = m.contract("MockCreditModule");

  // ============ Step 2: Deploy Core Contracts ============

  // Deploy Marketplace with dependencies
  const marketplace = m.contract("Marketplace", [
    mockOracle,
    mockWalrus,
    mockCreditModule,
  ]);

  // Deploy CreditHook
  const creditHook = m.contract("CreditHook", [mockCreditModule]);

  // Deploy Rewards with dependencies
  const rewards = m.contract("Rewards", [
    marketplace,
    mockCreditModule,
    mockWalrus,
  ]);

  // ============ Step 3: Configuration ============

  // Authorize Rewards contract to boost credits via CreditHook
  m.call(creditHook, "setAuthorizedCaller", [rewards, true]);

  // Fund Rewards pool with initial amount (10 CTC for testing)
  m.call(rewards, "fundRewards", [], {
    value: BigInt(10) * BigInt(10 ** 18), // 10 CTC
  });

  return {
    mockOracle,
    mockWalrus,
    mockCreditModule,
    marketplace,
    creditHook,
    rewards,
  };
});

export default SpaceLinkModule;
