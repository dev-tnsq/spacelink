// SPDX-License-Identifier: MIT
import { expect } from "chai";
import { ethers } from "hardhat";
import { PriceOracleAggregator, TokenRegistry } from "../typechain-types";

describe("PriceOracleAggregator and TokenRegistry Integration", function () {
  let priceOracle: PriceOracleAggregator;
  let tokenRegistry: TokenRegistry;
  let deployer: any;
  let user: any;

  const CTC_ADDRESS = "0x0000000000000000000000000000000000000001";

  beforeEach(async function () {
    [deployer, user] = await ethers.getSigners();

    // Deploy PriceOracleAggregator with zero address (no prover for basic tests)
    const PriceOracleAggregator = await ethers.getContractFactory("PriceOracleAggregator");
    priceOracle = await PriceOracleAggregator.deploy(ethers.constants.AddressZero);
    await priceOracle.deployed();

    // Deploy TokenRegistry with PriceOracleAggregator
    const TokenRegistry = await ethers.getContractFactory("TokenRegistry");
    tokenRegistry = await TokenRegistry.deploy(priceOracle.address);
    await tokenRegistry.deployed();
  });

  describe("TokenRegistry Oracle Integration", function () {
    it("Should initialize with CTC token", async function () {
      const ctcInfo = await tokenRegistry.getTokenInfo(CTC_ADDRESS);
      expect(ctcInfo.symbol).to.equal("CTC");
      expect(ctcInfo.name).to.equal("Creditcoin");
      expect(ctcInfo.supported).to.be.true;
    });

    it("Should add token to both registry and oracle", async function () {
      const mockToken = ethers.Wallet.createRandom().address;
      const initialPrice = ethers.utils.parseEther("2000"); // $2000

      // Add token to registry
      await tokenRegistry.addToken(mockToken, "MOCK", "Mock Token", 18, initialPrice);

      // Configure token in oracle
      await priceOracle.addToken(mockToken, 1, mockToken, 70); // Ethereum mainnet

      // Verify token is supported by oracle
      expect(await priceOracle.isTokenSupported(mockToken)).to.be.true;

      // Enable token for payments
      await tokenRegistry.setTokenSupported(mockToken, true);
      expect(await tokenRegistry.isSupportedToken(mockToken)).to.be.true;
    });

    it("Should update price from oracle", async function () {
      const mockToken = ethers.Wallet.createRandom().address;

      // Setup token
      await tokenRegistry.addToken(mockToken, "MOCK", "Mock Token", 18, ethers.utils.parseEther("2000"));
      await priceOracle.addToken(mockToken, 1, mockToken, 70);
      await tokenRegistry.setTokenSupported(mockToken, true);

      // Manually update price in oracle (simulating oracle update)
      await priceOracle.updatePriceManual(mockToken, ethers.utils.parseEther("2500"), 85);

      // Update registry from oracle
      await tokenRegistry.updatePriceFromOracle(mockToken);

      // Verify price was updated
      const tokenInfo = await tokenRegistry.getTokenInfo(mockToken);
      expect(tokenInfo.price).to.equal(ethers.utils.parseEther("2500"));
      expect(tokenInfo.oracleConfidence).to.equal(85);
    });

    it("Should reject price updates with insufficient confidence", async function () {
      const mockToken = ethers.Wallet.createRandom().address;

      // Setup token with high confidence requirement
      await tokenRegistry.addToken(mockToken, "MOCK", "Mock Token", 18, ethers.utils.parseEther("2000"));
      await priceOracle.addToken(mockToken, 1, mockToken, 90); // Require 90% confidence
      await tokenRegistry.setTokenSupported(mockToken, true);

      // Try to update with insufficient confidence
      await priceOracle.updatePriceManual(mockToken, ethers.utils.parseEther("2500"), 70);

      // This should revert due to insufficient confidence
      await expect(tokenRegistry.updatePriceFromOracle(mockToken)).to.be.revertedWith("Insufficient oracle confidence");
    });

    it("Should allow emergency manual price updates", async function () {
      const mockToken = ethers.Wallet.createRandom().address;

      // Setup token
      await tokenRegistry.addToken(mockToken, "MOCK", "Mock Token", 18, ethers.utils.parseEther("2000"));
      await tokenRegistry.setTokenSupported(mockToken, true);

      // Emergency update
      await tokenRegistry.emergencyUpdatePrice(mockToken, ethers.utils.parseEther("3000"));

      // Verify price was updated
      const tokenInfo = await tokenRegistry.getTokenInfo(mockToken);
      expect(tokenInfo.price).to.equal(ethers.utils.parseEther("3000"));
      expect(tokenInfo.oracleConfidence).to.equal(0); // Manual update
    });

    it("Should convert amounts correctly with oracle prices", async function () {
      const mockToken = ethers.Wallet.createRandom().address;

      // Setup token at $2000
      await tokenRegistry.addToken(mockToken, "MOCK", "Mock Token", 18, ethers.utils.parseEther("2000"));
      await priceOracle.addToken(mockToken, 1, mockToken, 70);
      await tokenRegistry.setTokenSupported(mockToken, true);

      // Update price to $2500
      await priceOracle.updatePriceManual(mockToken, ethers.utils.parseEther("2500"), 85);
      await tokenRegistry.updatePriceFromOracle(mockToken);

      // Test conversion: 1 token should equal 2500 CTC
      const ctcAmount = await tokenRegistry.convertToCTC(mockToken, ethers.utils.parseEther("1"));
      expect(ctcAmount).to.equal(ethers.utils.parseEther("2500"));

      // Test reverse conversion: 2500 CTC should equal 1 token
      const tokenAmount = await tokenRegistry.convertFromCTC(mockToken, ethers.utils.parseEther("2500"));
      expect(tokenAmount).to.equal(ethers.utils.parseEther("1"));
    });
  });

  describe("PriceOracleAggregator", function () {
    it("Should add and manage tokens", async function () {
      const mockToken = ethers.Wallet.createRandom().address;

      await priceOracle.addToken(mockToken, 1, mockToken, 70);

      expect(await priceOracle.isTokenSupported(mockToken)).to.be.true;

      const tokens = await priceOracle.getSupportedTokens();
      expect(tokens).to.include(mockToken);
    });

    it("Should update prices manually", async function () {
      const mockToken = ethers.Wallet.createRandom().address;

      await priceOracle.addToken(mockToken, 1, mockToken, 70);
      await priceOracle.updatePriceManual(mockToken, ethers.utils.parseEther("2000"), 85);

      const [price, timestamp, confidence] = await priceOracle.getPrice(mockToken);
      expect(price).to.equal(ethers.utils.parseEther("2000"));
      expect(confidence).to.equal(85);
    });

    it("Should enforce minimum confidence", async function () {
      const mockToken = ethers.Wallet.createRandom().address;

      await priceOracle.addToken(mockToken, 1, mockToken, 80); // Require 80% confidence

      await expect(
        priceOracle.updatePriceManual(mockToken, ethers.utils.parseEther("2000"), 70)
      ).to.be.revertedWith("Insufficient confidence");
    });
  });
});