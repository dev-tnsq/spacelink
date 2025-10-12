import { expect } from "chai";
import { ethers } from "hardhat";
import { Marketplace, Rewards, CreditHook, MockChainlinkOracle, MockWalrus, MockCreditModule } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("SpaceLink Marketplace", function () {
  let marketplace: Marketplace;
  let rewards: Rewards;
  let creditHook: CreditHook;
  let mockOracle: MockChainlinkOracle;
  let mockWalrus: MockWalrus;
  let mockCreditModule: MockCreditModule;
  
  let owner: SignerWithAddress;
  let nodeOperator: SignerWithAddress;
  let satOperator: SignerWithAddress;

  const STAKE_AMOUNT = ethers.parseEther("1"); // 1 CTC

  beforeEach(async function () {
    [owner, nodeOperator, satOperator] = await ethers.getSigners();

    // Deploy mocks
    const MockOracle = await ethers.getContractFactory("MockChainlinkOracle");
    mockOracle = await MockOracle.deploy();

    const MockWalrus = await ethers.getContractFactory("MockWalrus");
    mockWalrus = await MockWalrus.deploy();

    const MockCreditModule = await ethers.getContractFactory("MockCreditModule");
    mockCreditModule = await MockCreditModule.deploy();

    // Deploy core contracts
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(
      await mockOracle.getAddress(),
      await mockWalrus.getAddress(),
      await mockCreditModule.getAddress()
    );

    const CreditHook = await ethers.getContractFactory("CreditHook");
    creditHook = await CreditHook.deploy(await mockCreditModule.getAddress());

    const Rewards = await ethers.getContractFactory("Rewards");
    rewards = await Rewards.deploy(
      await marketplace.getAddress(),
      await mockCreditModule.getAddress(),
      await mockWalrus.getAddress()
    );

    // Configure
    await creditHook.setAuthorizedCaller(await rewards.getAddress(), true);
    await rewards.fundRewards({ value: ethers.parseEther("10") });
  });

  describe("Node Registration", function () {
    it("Should register a node with valid parameters", async function () {
      const lat = 140583; // 14.0583°
      const lon = 777093; // 77.7093°
      const specs = "S-band, 100 Mbps";
      const uptime = 98;

      const tx = await marketplace.connect(nodeOperator).registerNode(
        lat,
        lon,
        specs,
        uptime,
        { value: STAKE_AMOUNT }
      );

      await expect(tx)
        .to.emit(marketplace, "NodeRegistered")
        .withArgs(1, nodeOperator.address, lat, lon, specs, await ethers.resolveAddress);

      const node = await marketplace.getNode(1);
      expect(node.owner).to.equal(nodeOperator.address);
      expect(node.lat).to.equal(lat);
      expect(node.lon).to.equal(lon);
      expect(node.active).to.equal(true);
    });

    it("Should reject registration with insufficient stake", async function () {
      await expect(
        marketplace.connect(nodeOperator).registerNode(
          140583,
          777093,
          "S-band, 100 Mbps",
          98,
          { value: ethers.parseEther("0.5") }
        )
      ).to.be.revertedWithCustomError(marketplace, "InsufficientStake");
    });

    it("Should reject invalid coordinates", async function () {
      await expect(
        marketplace.connect(nodeOperator).registerNode(
          9999999, // Invalid latitude
          777093,
          "S-band, 100 Mbps",
          98,
          { value: STAKE_AMOUNT }
        )
      ).to.be.revertedWithCustomError(marketplace, "InvalidCoordinates");
    });
  });

  describe("Satellite Registration", function () {
    const validTLE1 = "1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927";
    const validTLE2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537";

    it("Should register a satellite with valid TLE", async function () {
      const tx = await marketplace.connect(satOperator).registerSatellite(
        validTLE1,
        validTLE2,
        { value: STAKE_AMOUNT }
      );

      await expect(tx)
        .to.emit(marketplace, "SatelliteRegistered");

      const sat = await marketplace.getSatellite(1);
      expect(sat.owner).to.equal(satOperator.address);
      expect(sat.tle1).to.equal(validTLE1);
      expect(sat.tle2).to.equal(validTLE2);
      expect(sat.active).to.equal(true);
    });

    it("Should reject invalid TLE format", async function () {
      await expect(
        marketplace.connect(satOperator).registerSatellite(
          "invalid",
          "tle",
          { value: STAKE_AMOUNT }
        )
      ).to.be.revertedWithCustomError(marketplace, "InvalidTLE");
    });
  });

  describe("Pass Booking", function () {
    beforeEach(async function () {
      // Register node
      await marketplace.connect(nodeOperator).registerNode(
        140583,
        777093,
        "S-band, 100 Mbps",
        98,
        { value: STAKE_AMOUNT }
      );

      // Register satellite
      const validTLE1 = "1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927";
      const validTLE2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537";
      await marketplace.connect(satOperator).registerSatellite(
        validTLE1,
        validTLE2,
        { value: STAKE_AMOUNT }
      );
    });

    it("Should book a pass successfully", async function () {
      const tx = await marketplace.connect(satOperator).bookPass(
        1, // nodeId
        1, // satId
        7, // duration
        { value: STAKE_AMOUNT }
      );

      await expect(tx).to.emit(marketplace, "PassBooked");

      const pass = await marketplace.getPass(1);
      expect(pass.operator).to.equal(satOperator.address);
      expect(pass.nodeId).to.equal(1);
      expect(pass.satId).to.equal(1);
      expect(pass.completed).to.equal(false);
    });

    it("Should reject invalid duration", async function () {
      await expect(
        marketplace.connect(satOperator).bookPass(
          1,
          1,
          15, // Invalid: > 10 minutes
          { value: STAKE_AMOUNT }
        )
      ).to.be.revertedWithCustomError(marketplace, "InvalidDuration");
    });
  });

  describe("Pass Completion and Rewards", function () {
    let passId: number;

    beforeEach(async function () {
      // Register node
      await marketplace.connect(nodeOperator).registerNode(
        140583,
        777093,
        "S-band, 100 Mbps",
        98,
        { value: STAKE_AMOUNT }
      );

      // Register satellite
      const validTLE1 = "1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927";
      const validTLE2 = "2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537";
      await marketplace.connect(satOperator).registerSatellite(
        validTLE1,
        validTLE2,
        { value: STAKE_AMOUNT }
      );

      // Book pass
      await marketplace.connect(satOperator).bookPass(1, 1, 7, { value: STAKE_AMOUNT });
      passId = 1;
    });

    it("Should complete pass with proof", async function () {
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("relay_data"));

      const tx = await marketplace.connect(nodeOperator).completePass(passId, proofHash);

      await expect(tx)
        .to.emit(marketplace, "PassCompleted")
        .withArgs(passId, nodeOperator.address, proofHash);

      const pass = await marketplace.getPass(passId);
      expect(pass.completed).to.equal(true);
      expect(pass.proofHash).to.equal(proofHash);
    });

    it("Should reject completion by non-owner", async function () {
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes("relay_data"));

      await expect(
        marketplace.connect(satOperator).completePass(passId, proofHash)
      ).to.be.revertedWithCustomError(marketplace, "NotNodeOwner");
    });
  });

  describe("Credit System", function () {
    it("Should boost credit score", async function () {
      const initialScore = await mockCreditModule.getCreditScore(nodeOperator.address);
      expect(initialScore).to.equal(0);

      await creditHook.connect(owner).boostCredit(nodeOperator.address, 10);

      const newScore = await mockCreditModule.getCreditScore(nodeOperator.address);
      expect(newScore).to.equal(10);
    });

    it("Should check BNPL eligibility", async function () {
      // Set score to 650 (minimum for BNPL)
      await mockCreditModule.setInitialScore(nodeOperator.address, 650);

      const [eligible, score, maxLoan] = await creditHook.checkBNPLEligibility(
        nodeOperator.address,
        ethers.parseEther("500")
      );

      expect(eligible).to.equal(true);
      expect(score).to.equal(650);
      expect(maxLoan).to.equal(ethers.parseEther("500"));
    });

    it("Should project credit growth", async function () {
      await mockCreditModule.setInitialScore(nodeOperator.address, 600);

      const [projectedScore, projectedMaxLoan] = await creditHook.projectCreditGrowth(
        nodeOperator.address,
        10 // 10 relays
      );

      expect(projectedScore).to.equal(700); // 600 + (10 * 10)
      expect(projectedMaxLoan).to.be.gt(ethers.parseEther("500")); // Above minimum
    });
  });
});
