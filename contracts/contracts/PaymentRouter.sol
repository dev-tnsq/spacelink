// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPaymentRouter.sol";

/**
 * @title PaymentRouter
 * @notice Multi-token payment routing with DEX integration
 * @dev Handles token swaps, conversions, and secure transfers
 */
contract PaymentRouter is IPaymentRouter, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice DEX router address (Uniswap V2/V3 compatible)
    address public dexRouter;

    /// @notice Maximum slippage for swaps (basis points)
    uint256 public maxSlippage = 300; // 3%

    /// @notice Supported tokens
    mapping(address => TokenInfo) public tokenInfos;

    /// @notice All supported tokens
    address[] public supportedTokens;

    // ============ Events ============

    event DexRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event MaxSlippageUpdated(uint256 oldSlippage, uint256 newSlippage);

    // ============ Errors ============

    error TokenNotSupported();
    error InsufficientAmount();
    error TransferFailed();
    error SwapFailed();
    error SlippageTooHigh();

    // ============ Constructor ============

    constructor(address _dexRouter) {
        dexRouter = _dexRouter;
        _transferOwnership(msg.sender);

        // Add native CTC by default
        tokenInfos[address(0)] = TokenInfo({
            supported: true,
            isNative: true,
            decimals: 18,
            priceFeed: address(0) // Native token doesn't need price feed
        });
    }

    // ============ Core Functions ============

    /**
     * @notice Route payment from one token to another
     * @param _fromToken Source token address (address(0) for native)
     * @param _fromAddress Sender address
     * @param _toAddress Recipient address
     * @param _amount Amount to route
     */
    function routePayment(
        address _fromToken,
        address _fromAddress,
        address _toAddress,
        uint256 _amount
    ) external payable override nonReentrant whenNotPaused {
        require(_amount > 0, "Invalid amount");

        if (_fromToken == address(0)) {
            // Native token transfer
            require(msg.value >= _amount, "Insufficient native payment");
            (bool success,) = payable(_toAddress).call{value: _amount}("");
            require(success, "Native transfer failed");

            // Refund excess
            if (msg.value > _amount) {
                (bool refundSuccess,) = payable(_fromAddress).call{value: msg.value - _amount}("");
                require(refundSuccess, "Refund failed");
            }
        } else {
            // ERC20 transfer
            require(tokenInfos[_fromToken].supported, "Source token not supported");
            IERC20(_fromToken).safeTransferFrom(_fromAddress, _toAddress, _amount);
        }

        emit PaymentRouted(_fromToken, _fromToken, _amount, _amount, _toAddress);
    }

    /**
     * @notice Route payment with specific output token
     * @param _fromToken Source token address
     * @param _toToken Target token address
     * @param _fromAddress Sender address
     * @param _toAddress Recipient address
     * @param _amount Amount to route
     */
    function routePaymentToToken(
        address _fromToken,
        address _toToken,
        address _fromAddress,
        address _toAddress,
        uint256 _amount
    ) external payable override nonReentrant whenNotPaused {
        require(_fromToken != _toToken, "Same token");
        require(tokenInfos[_fromToken].supported, "Source token not supported");
        require(tokenInfos[_toToken].supported, "Target token not supported");

        // For now, implement direct transfer (DEX integration would be added)
        // In production, this would use the DEX router for swaps
        if (_fromToken == address(0)) {
            require(msg.value >= _amount, "Insufficient payment");
            // Convert native to target token via DEX (simplified)
            _swapNativeToToken(_toToken, _amount, _toAddress);

            // Refund excess
            if (msg.value > _amount) {
                (bool refundSuccess,) = payable(_fromAddress).call{value: msg.value - _amount}("");
                require(refundSuccess, "Refund failed");
            }
        } else {
            // ERC20 to ERC20 swap
            IERC20(_fromToken).safeTransferFrom(_fromAddress, address(this), _amount);
            _swapTokens(_fromToken, _toToken, _amount, _toAddress);
        }
    }

    /**
     * @notice Calculate output amount for token swap
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
    ) external view override returns (uint256 expectedOutput, SwapRoute memory swapRoute) {
        // Simplified calculation - in production would query DEX
        uint256 fromPrice = getTokenPrice(_fromToken);
        uint256 toPrice = getTokenPrice(_toToken);

        if (fromPrice == 0 || toPrice == 0) return (0, swapRoute);

        expectedOutput = (_amount * fromPrice) / toPrice;

        // Apply slippage
        expectedOutput = (expectedOutput * (10000 - maxSlippage)) / 10000;

        // Create basic swap route
        address[] memory path = new address[](2);
        path[0] = _fromToken;
        path[1] = _toToken;

        swapRoute = SwapRoute({
            path: path,
            expectedOutput: expectedOutput,
            slippage: maxSlippage
        });
    }

    // ============ Internal Functions ============

    /**
     * @notice Swap native token to ERC20
     * @param _toToken Target token
     * @param _amount Amount to swap
     * @param _recipient Recipient address
     */
    function _swapNativeToToken(
        address _toToken,
        uint256 _amount,
        address _recipient
    ) internal {
        // Simplified implementation - in production would use DEX router
        // For now, just transfer the amount (assuming 1:1 conversion for demo)
        IERC20(_toToken).safeTransfer(_recipient, _amount);
        emit PaymentRouted(address(0), _toToken, _amount, _amount, _recipient);
    }

    /**
     * @notice Swap ERC20 tokens
     * @param _fromToken Source token
     * @param _toToken Target token
     * @param _amount Amount to swap
     * @param _recipient Recipient address
     */
    function _swapTokens(
        address _fromToken,
        address _toToken,
        uint256 _amount,
        address _recipient
    ) internal {
        // Simplified implementation - in production would use DEX router
        // For now, just transfer the amount (assuming 1:1 conversion for demo)
        IERC20(_toToken).safeTransfer(_recipient, _amount);
        emit PaymentRouted(_fromToken, _toToken, _amount, _amount, _recipient);
    }

    // ============ View Functions ============

    /**
     * @notice Get token information
     * @param _token Token address
     * @return Token info struct
     */
    function getTokenInfo(address _token) external view override returns (TokenInfo memory) {
        return tokenInfos[_token];
    }

    /**
     * @notice Check if token is supported
     * @param _token Token address
     * @return bool True if supported
     */
    function isTokenSupported(address _token) external view override returns (bool) {
        return tokenInfos[_token].supported;
    }

    /**
     * @notice Get all supported tokens
     * @return Array of supported token addresses
     */
    function getSupportedTokens() external view override returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @notice Get token price in USD (with 8 decimals)
     * @param _token Token address
     * @return uint256 Price in USD
     */
    function getTokenPrice(address _token) public view override returns (uint256) {
        if (_token == address(0)) return 1e8; // $1 for native token (simplified)

        TokenInfo memory info = tokenInfos[_token];
        if (!info.supported || info.priceFeed == address(0)) return 0;

        // In production, this would query Chainlink price feed
        // For demo, return mock prices
        if (_token == address(0x123)) return 2000e8; // Mock USDC price
        if (_token == address(0x456)) return 3000e8; // Mock WBTC price

        return 1e8; // Default $1
    }

    /**
     * @notice Convert amount between tokens
     * @param _fromToken Source token
     * @param _toToken Target token
     * @param _amount Amount in fromToken
     * @return uint256 Equivalent amount in toToken
     */
    function convertAmount(
        address _fromToken,
        address _toToken,
        uint256 _amount
    ) external view override returns (uint256) {
        uint256 fromPrice = getTokenPrice(_fromToken);
        uint256 toPrice = getTokenPrice(_toToken);

        if (fromPrice == 0 || toPrice == 0) return 0;

        return (_amount * fromPrice) / toPrice;
    }

    // ============ Admin Functions ============

    /**
     * @notice Add support for a token
     * @param _token Token address
     * @param _decimals Token decimals
     * @param _priceFeed Chainlink price feed address
     */
    function addToken(
        address _token,
        uint256 _decimals,
        address _priceFeed
    ) external override onlyOwner {
        require(_token != address(0), "Invalid token");
        require(!tokenInfos[_token].supported, "Token already supported");
        require(_decimals > 0 && _decimals <= 18, "Invalid decimals");

        tokenInfos[_token] = TokenInfo({
            supported: true,
            isNative: false,
            decimals: _decimals,
            priceFeed: _priceFeed
        });

        supportedTokens.push(_token);
        emit TokenAdded(_token, _decimals);
    }

    /**
     * @notice Remove support for a token
     * @param _token Token address
     */
    function removeToken(address _token) external override onlyOwner {
        require(tokenInfos[_token].supported, "Token not supported");

        tokenInfos[_token].supported = false;

        // Remove from supported tokens array
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == _token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }

        emit TokenRemoved(_token);
    }

    /**
     * @notice Update price feed for token
     * @param _token Token address
     * @param _priceFeed New price feed address
     */
    function updatePriceFeed(address _token, address _priceFeed) external override onlyOwner {
        require(tokenInfos[_token].supported, "Token not supported");
        emit PriceFeedUpdated(_token, tokenInfos[_token].priceFeed, _priceFeed);
        tokenInfos[_token].priceFeed = _priceFeed;
    }

    /**
     * @notice Set DEX router address
     * @param _dexRouter New DEX router address
     */
    function setDexRouter(address _dexRouter) external override onlyOwner {
        require(_dexRouter != address(0), "Invalid DEX router");
        emit DexRouterUpdated(dexRouter, _dexRouter);
        dexRouter = _dexRouter;
    }

    /**
     * @notice Set maximum slippage for swaps
     * @param _slippage New slippage in basis points
     */
    function setMaxSlippage(uint256 _slippage) external override onlyOwner {
        require(_slippage <= 10000, "Invalid slippage"); // Max 100%
        emit MaxSlippageUpdated(maxSlippage, _slippage);
        maxSlippage = _slippage;
    }

    /**
     * @notice Pause contract (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Fallback ============

    receive() external payable {}
}