// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPaymentRouter
 * @notice Interface for multi-token payment routing
 * @dev Routes payments between different tokens and handles token swaps
 */
interface IPaymentRouter {
    // ============ Structs ============

    struct TokenInfo {
        bool supported;                 // Whether token is supported
        bool isNative;                  // Whether it's native CTC
        uint256 decimals;               // Token decimals
        address priceFeed;              // Chainlink price feed address
    }

    struct SwapRoute {
        address[] path;                 // Swap path for DEX
        uint256 expectedOutput;         // Expected output amount
        uint256 slippage;               // Allowed slippage (basis points)
    }

    // ============ Events ============

    event PaymentRouted(
        address indexed fromToken,
        address indexed toToken,
        uint256 amountIn,
        uint256 amountOut,
        address indexed recipient
    );

    event TokenAdded(address indexed token, uint256 decimals);
    event TokenRemoved(address indexed token);
    event PriceFeedUpdated(address indexed token, address indexed oldFeed, address indexed newFeed);

    // ============ Core Functions ============

    /**
     * @notice Routes payment from one token to another
     * @param _fromToken Source token address (address(0) for native)
     * @param _fromAddress Sender address
     * @param _toAddress Recipient address
     * @param _amount Amount to route
     * @dev Handles token transfers and optional swaps
     */
    function routePayment(
        address _fromToken,
        address _fromAddress,
        address _toAddress,
        uint256 _amount
    ) external payable;

    /**
     * @notice Routes payment with specific output token
     * @param _fromToken Source token address
     * @param _toToken Target token address
     * @param _fromAddress Sender address
     * @param _toAddress Recipient address
     * @param _amount Amount to route
     * @dev Swaps tokens if necessary
     */
    function routePaymentToToken(
        address _fromToken,
        address _toToken,
        address _fromAddress,
        address _toAddress,
        uint256 _amount
    ) external payable;

    /**
     * @notice Calculates output amount for token swap
     * @param _fromToken Source token
     * @param _toToken Target token
     * @param _amount Input amount
     * @return expectedOutput Expected output amount
     * @return swapRoute Optimal swap route
     */
    function calculateSwap(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) external view returns (uint256 expectedOutput, SwapRoute memory swapRoute);

    // ============ View Functions ============

    /**
     * @notice Gets token information
     * @param _token Token address
     * @return Token info struct
     */
    function getTokenInfo(address _token) external view returns (TokenInfo memory);

    /**
     * @notice Checks if token is supported
     * @param _token Token address
     * @return bool True if supported
     */
    function isTokenSupported(address _token) external view returns (bool);

    /**
     * @notice Gets all supported tokens
     * @return Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory);

    /**
     * @notice Gets token price in USD (with 8 decimals)
     * @param _token Token address
     * @return uint256 Price in USD
     */
    function getTokenPrice(address _token) external view returns (uint256);

    /**
     * @notice Converts amount between tokens
     * @param _fromToken Source token
     * @param _toToken Target token
     * @param _amount Amount in fromToken
     * @return uint256 Equivalent amount in toToken
     */
    function convertAmount(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) external view returns (uint256);

    // ============ Admin Functions ============

    /**
     * @notice Adds support for a token
     * @param _token Token address
     * @param _decimals Token decimals
     * @param _priceFeed Chainlink price feed address
     */
    function addToken(
        address _token,
        uint256 _decimals,
        address _priceFeed
    ) external;

    /**
     * @notice Removes support for a token
     * @param _token Token address
     */
    function removeToken(address _token) external;

    /**
     * @notice Updates price feed for token
     * @param _token Token address
     * @param _priceFeed New price feed address
     */
    function updatePriceFeed(address _token, address _priceFeed) external;

    /**
     * @notice Sets DEX router address
     * @param _dexRouter New DEX router address
     */
    function setDexRouter(address _dexRouter) external;

    /**
     * @notice Sets maximum slippage for swaps
     * @param _slippage New slippage in basis points
     */
    function setMaxSlippage(uint256 _slippage) external;
}