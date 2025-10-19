// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

// USC Integration imports
import "@gluwa/creditcoin-public-prover/sol/Types.sol";
import "./interfaces/ICreditcoinPublicProver.sol";

/**
 * @title PriceOracleAggregator
 * @notice Decentralized price oracle aggregator for Creditcoin
 * @dev Aggregates price data from multiple sources with confidence scoring
 * @notice Ready for future integration with Creditcoin's Universal Oracle (USC)
 */
contract PriceOracleAggregator is Ownable, AccessControl, ReentrancyGuard, Pausable {

    // ============ Roles ============

    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");
    bytes32 public constant PRICE_FEED_ROLE = keccak256("PRICE_FEED_ROLE");

    // ============ Structs ============

    struct PriceData {
        uint256 price;          // Price in USD (18 decimals)
        uint256 timestamp;      // When price was recorded
        uint256 confidence;     // Confidence score (0-100)
        address source;         // Source address
        bytes32 queryId;        // Query ID (for future USC integration)
    }

    struct TokenConfig {
        address tokenAddress;   // Token contract address
        uint256 chainId;        // Source chain ID
        address priceFeed;      // Price feed contract on source chain
        bool isActive;          // Whether this token is supported
        uint256 minConfidence;  // Minimum confidence required
    }

    // ============ State Variables ============

    /// @notice Maximum age for price data (1 hour)
    uint256 public constant MAX_PRICE_AGE = 1 hours;

    /// @notice Minimum confidence score required (70%)
    uint256 public constant MIN_CONFIDENCE = 70;

    /// @notice Mapping of token address to latest price data
    mapping(address => PriceData) public tokenPrices;

    /// @notice Mapping of token address to configuration
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice Array of supported tokens
    address[] public supportedTokens;

    // ============ USC Integration State ============

    /// @notice Creditcoin Public Prover contract address
    ICreditcoinPublicProver public proverContract;

    /// @notice Mapping of query IDs to token addresses for tracking USC queries
    mapping(bytes32 => address) public queryToToken;

    /// @notice Mapping of token addresses to pending query IDs
    mapping(address => bytes32) public tokenPendingQueries;

    // ============ Events ============

    event PriceUpdated(
        address indexed token,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 confidence,
        bytes32 queryId
    );

    event TokenAdded(
        address indexed token,
        uint256 chainId,
        address priceFeed
    );

    event TokenRemoved(address indexed token);

    // ============ USC Events ============

    event PriceQuerySubmitted(
        address indexed token,
        bytes32 indexed queryId,
        uint256 chainId,
        uint256 cost
    );

    event PriceQueryResultProcessed(
        address indexed token,
        bytes32 indexed queryId,
        uint256 price,
        uint256 confidence
    );

    // ============ Errors ============

    error InvalidPriceData();
    error InsufficientConfidence();
    error PriceTooOld();
    error TokenNotSupported();
    error InvalidTokenConfig();

    // ============ Constructor ============

    constructor(address _proverContract) {
        // Allow zero address for basic testing without USC functionality
        if (_proverContract != address(0)) {
            proverContract = ICreditcoinPublicProver(_proverContract);
        }
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_UPDATER_ROLE, msg.sender);
        _grantRole(PRICE_FEED_ROLE, msg.sender);
    }

    // ============ Admin Functions ============

    /**
     * @notice Add support for a new token
     * @param token Address of the token
     * @param chainId Source chain ID
     * @param priceFeed Price feed contract address on source chain
     * @param minConfidence Minimum confidence score required
     */
    function addToken(
        address token,
        uint256 chainId,
        address priceFeed,
        uint256 minConfidence
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0), "Invalid token address");
        require(priceFeed != address(0), "Invalid price feed");
        require(minConfidence <= 100, "Invalid confidence");
        require(tokenConfigs[token].tokenAddress == address(0), "Token already exists");

        tokenConfigs[token] = TokenConfig({
            tokenAddress: token,
            chainId: chainId,
            priceFeed: priceFeed,
            isActive: true,
            minConfidence: minConfidence
        });

        supportedTokens.push(token);

        emit TokenAdded(token, chainId, priceFeed);
    }

    /**
     * @notice Remove support for a token
     * @param token Address of the token to remove
     */
    function removeToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenConfigs[token].isActive, "Token not active");

        tokenConfigs[token].isActive = false;

        // Remove from supported tokens array
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }

        emit TokenRemoved(token);
    }

    // ============ Price Update Functions ============

    /**
     * @notice Update price manually (oracle role only)
     * @param token Token address
     * @param price New price in USD (18 decimals)
     * @param confidence Confidence score (0-100)
     */
    function updatePriceManual(
        address token,
        uint256 price,
        uint256 confidence
    ) external onlyRole(ORACLE_UPDATER_ROLE) whenNotPaused {
        require(tokenConfigs[token].isActive, "Token not supported");
        require(price > 0, "Invalid price");
        require(confidence >= tokenConfigs[token].minConfidence, "Insufficient confidence");

        uint256 oldPrice = tokenPrices[token].price;

        tokenPrices[token] = PriceData({
            price: price,
            timestamp: block.timestamp,
            confidence: confidence,
            source: msg.sender,
            queryId: bytes32(0) // Manual update
        });

        emit PriceUpdated(token, oldPrice, price, confidence, bytes32(0));
    }

    /**
     * @notice Update price from automated feed (future USC integration)
     * @param token Token address
     * @param price New price in USD (18 decimals)
     * @param confidence Confidence score (0-100)
     * @param queryId USC query ID
     */
    function updatePriceFromFeed(
        address token,
        uint256 price,
        uint256 confidence,
        bytes32 queryId
    ) external onlyRole(PRICE_FEED_ROLE) whenNotPaused {
        require(tokenConfigs[token].isActive, "Token not supported");
        require(price > 0, "Invalid price");
        require(confidence >= tokenConfigs[token].minConfidence, "Insufficient confidence");

        uint256 oldPrice = tokenPrices[token].price;

        tokenPrices[token] = PriceData({
            price: price,
            timestamp: block.timestamp,
            confidence: confidence,
            source: msg.sender,
            queryId: queryId
        });

        emit PriceUpdated(token, oldPrice, price, confidence, queryId);
    }

    // ============ USC Integration Functions ============

    /**
     * @notice Submit a USC price query for a token
     * @param token Token address to query price for
     * @param targetChainId Chain ID where the price feed exists
     * @param targetBlockHeight Block height to query
     * @param queryLayout Layout segments defining what data to extract
     */
    function submitPriceQuery(
        address token,
        uint64 targetChainId,
        uint64 targetBlockHeight,
        LayoutSegment[] calldata queryLayout
    ) external payable onlyRole(PRICE_FEED_ROLE) whenNotPaused {
        require(address(proverContract) != address(0), "USC functionality not available");
        require(tokenConfigs[token].isActive, "Token not supported");
        require(tokenPendingQueries[token] == bytes32(0), "Query already pending for token");

        // Build the chain query
        ChainQuery memory query = ChainQuery({
            chainId: targetChainId,
            height: targetBlockHeight,
            index: 0, // Transaction index (0 for contract calls)
            layoutSegments: queryLayout
        });

        // Compute the actual query cost from the prover contract
        uint256 queryCost = proverContract.computeQueryCost(query);
        require(msg.value >= queryCost, "Insufficient payment for query cost");

        // Submit query to prover contract
        proverContract.submitQuery{value: queryCost}(query, address(this));
        
        // Compute query ID (same logic as prover contract)
        bytes32 queryId = keccak256(abi.encode(query));
        
        // Store query tracking
        queryToToken[queryId] = token;
        tokenPendingQueries[token] = queryId;

        emit PriceQuerySubmitted(token, queryId, targetChainId, queryCost);
    }

    /**
     * @notice Process results from a completed USC price query
     * @param queryId The query ID to process results for
     */
    function processPriceQueryResult(bytes32 queryId) external onlyRole(PRICE_FEED_ROLE) whenNotPaused {
        require(address(proverContract) != address(0), "USC functionality not available");
        address token = queryToToken[queryId];
        require(token != address(0), "Query ID not found");
        require(tokenPendingQueries[token] == queryId, "Query not pending for token");

        // Get query details from prover contract
        QueryDetails memory queryDetails = proverContract.getQueryDetails(queryId);
        require(queryDetails.state == QueryState.ResultAvailable, "Query result not available");

        // Process result segments to extract price data
        // This is a simplified example - in practice, you'd decode the specific
        // data format from your price feed contract
        uint256 extractedPrice = _extractPriceFromResult(queryDetails.resultSegments);
        uint256 confidence = 95; // High confidence for verified cross-chain data

        // Update price using the verified data
        uint256 oldPrice = tokenPrices[token].price;
        tokenPrices[token] = PriceData({
            price: extractedPrice,
            timestamp: block.timestamp,
            confidence: confidence,
            source: address(this), // USC-verified source
            queryId: queryId
        });

        // Clear pending query
        delete tokenPendingQueries[token];
        delete queryToToken[queryId];

        emit PriceUpdated(token, oldPrice, extractedPrice, confidence, queryId);
        emit PriceQueryResultProcessed(token, queryId, extractedPrice, confidence);
    }

    /**
     * @notice Extract price data from USC result segments
     * @param resultSegments Array of result segments from USC query
     * @return price The extracted price value
     */
    function _extractPriceFromResult(ResultSegment[] memory resultSegments) internal pure returns (uint256) {
        // This is a placeholder implementation
        // In practice, you would decode the specific ABI-encoded data
        // from your price feed contract based on the layout segments used
        require(resultSegments.length > 0, "No result segments");
        
        // For demonstration, assume the price is in the first result segment
        // In reality, you'd decode based on your specific query layout
        bytes32 priceData = resultSegments[0].abiBytes;
        return uint256(priceData); // Simplified extraction
    }

    // ============ View Functions ============

    /**
     * @notice Get latest price for a token
     * @param token Token address
     * @return price Price in USD (18 decimals)
     * @return timestamp When price was last updated
     * @return confidence Confidence score
     */
    function getPrice(address token) external view returns (
        uint256 price,
        uint256 timestamp,
        uint256 confidence
    ) {
        PriceData memory data = tokenPrices[token];
        require(data.timestamp > 0, "No price data available");
        require(block.timestamp - data.timestamp <= MAX_PRICE_AGE, "Price data too old");

        return (data.price, data.timestamp, data.confidence);
    }

    /**
     * @notice Check if token is supported
     * @param token Token address
     */
    function isTokenSupported(address token) external view returns (bool) {
        return tokenConfigs[token].isActive;
    }

    /**
     * @notice Get number of supported tokens
     */
    function getSupportedTokensCount() external view returns (uint256) {
        return supportedTokens.length;
    }

    /**
     * @notice Get all supported tokens
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency pause
     */
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Emergency unpause
     */
    function emergencyUnpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}