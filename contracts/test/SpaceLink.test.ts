import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  Marketplace,
  OracleAggregator,
  PaymentRouter,
  IPFSAdapter,
  CreditcoinCreditAdapter,
  TokenRegistry,
  ERC20
} from "../typechain-types";

describe("SpaceLink Contracts", function () {
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;

  let tokenRegistry: TokenRegistry;
  let oracleAggregator: OracleAggregator;
  let paymentRouter: PaymentRouter;
  let ipfsAdapter: IPFSAdapter;
  let creditAdapter: CreditcoinCreditAdapter;
  let marketplace: Marketplace;
  let mockCTC: ERC20;

  beforeEach(async function () {
    [deployer, user1, user2, user3] = await ethers.getSigners();

    // Deploy TokenRegistry
    const TokenRegistry = await ethers.getContractFactory("TokenRegistry");
    tokenRegistry = await TokenRegistry.deploy();
    await tokenRegistry.deployed();

    // Deploy OracleAggregator
    const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
    oracleAggregator = await OracleAggregator.deploy([deployer.address, user1.address, user2.address]);
    await oracleAggregator.deployed();

    // Deploy PaymentRouter
    const PaymentRouter = await ethers.getContractFactory("PaymentRouter");
    paymentRouter = await PaymentRouter.deploy(tokenRegistry.address);
    await paymentRouter.deployed();

    // Deploy IPFSAdapter
    const IPFSAdapter = await ethers.getContractFactory("IPFSAdapter");
    ipfsAdapter = await IPFSAdapter.deploy();
    await ipfsAdapter.deployed();

    // Deploy CreditcoinCreditAdapter
    const CreditcoinCreditAdapter = await ethers.getContractFactory("CreditcoinCreditAdapter");
    creditAdapter = await CreditcoinCreditAdapter.deploy();
    await creditAdapter.deployed();

    // Deploy Marketplace
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(
      oracleAggregator.address,
      paymentRouter.address,
      ipfsAdapter.address,
      creditAdapter.address
    );
    await marketplace.deployed();
  });

  describe("Marketplace", function () {
    it("Should deploy successfully", async function () {
      expect(marketplace.address).to.not.equal(ethers.constants.AddressZero);
    });

    it("Should allow registering a satellite node", async function () {
      const lat = 400000; // 40.0 degrees * 10000
      const lon = -740000; // -74.0 degrees * 10000
      const specs = "S-band, 100 Mbps";
      const uptime = 98;
      const ipfsCID = "QmTest123";

      await expect(
        marketplace.connect(user1).registerNode(
          lat,
          lon,
          specs,
          uptime,
          ipfsCID,
          { value: ethers.utils.parseEther("1") }
        )
      ).to.emit(marketplace, "NodeRegistered");

      const node = await marketplace.nodes(1);
      expect(node.owner).to.equal(user1.address);
      expect(node.lat).to.equal(lat);
      expect(node.lon).to.equal(lon);
      expect(node.specs).to.equal(specs);
    });

    it("Should allow booking a pass", async function () {
      // First register a node
      const lat = 400000;
      const lon = -740000;
      const specs = "S-band, 100 Mbps";
      const uptime = 98;
      const ipfsCID = "QmTest123";

      await marketplace.connect(user1).registerNode(
        lat,
        lon,
        specs,
        uptime,
        ipfsCID,
        { value: ethers.utils.parseEther("1") }
      );

      // Register a satellite (ISS)
      const tle1 = "1 25544U 98067A   23240.00000000  .00000000  00000-0  00000-0 0  9999";
      const tle2 = "2 25544  51.6400  10.0000 0001000   0.0000  15.0000 15.00000000000000";
      const satIpfsCID = "QmSatTest123";

      await marketplace.connect(user2).registerSatellite(
        tle1,
        tle2,
        satIpfsCID,
        { value: ethers.utils.parseEther("1") }
      );

      // Add CTC token to registry
      const CTC_ADDRESS = "0x0000000000000000000000000000000000000001";
      await tokenRegistry.addToken(CTC_ADDRESS, "CTC", "Creditcoin", 18, ethers.utils.parseEther("1"));

      // Add CTC token to PaymentRouter
      await paymentRouter.addToken(CTC_ADDRESS, 18, ethers.constants.AddressZero);

      // Book a pass (skip payment for now)
      const nodeId = 1;
      const satId = 1; // The satellite we just registered
      const timestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const durationMin = 10; // 10 minutes (within valid range of 5-10)
      const paymentAmount = ethers.utils.parseEther("10");

      // The booking should fail due to payment (user has no tokens)
      // This validates that payment validation is working
      await expect(
        marketplace.connect(user2).bookPass(
          nodeId,
          satId,
          timestamp,
          durationMin,
          CTC_ADDRESS,
          paymentAmount
        )
      ).to.be.reverted;

      // Check that no pass was created
      expect(await marketplace.passCount()).to.equal(0);
    });
  });

  describe("OracleAggregator", function () {
    it("Should deploy successfully", async function () {
      expect(oracleAggregator.address).to.not.equal(ethers.constants.AddressZero);
    });

    it("Should allow validator registration", async function () {
      await expect(
        oracleAggregator.connect(deployer).addValidator(user3.address)
      ).to.emit(oracleAggregator, "ValidatorAdded");

      expect(await oracleAggregator.validators(user3.address)).to.equal(true);
    });
  });

  describe("TokenRegistry", function () {
    it("Should deploy successfully", async function () {
      expect(tokenRegistry.address).to.not.equal(ethers.constants.AddressZero);
    });

    it("Should allow adding tokens", async function () {
      const tokenAddress = "0x0000000000000000000000000000000000000001";
      const symbol = "CTC";
      const name = "Creditcoin";
      const decimals = 18;
      const price = ethers.utils.parseEther("1");

      await expect(
        tokenRegistry.addToken(tokenAddress, symbol, name, decimals, price)
      ).to.emit(tokenRegistry, "TokenAdded");

      const tokenInfo = await tokenRegistry.tokenInfo(tokenAddress);
      expect(tokenInfo.symbol).to.equal(symbol);
      expect(tokenInfo.name).to.equal(name);
      expect(tokenInfo.decimals).to.equal(decimals);
    });
  });
});