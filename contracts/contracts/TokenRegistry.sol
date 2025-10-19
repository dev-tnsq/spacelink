// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./PriceOracleAggregator.sol";

/**
 * @title TokenRegistry
 * @notice Registry of supported tokens with decentralized price feeds via Creditcoin Universal Oracle
 * @dev Manages supported payment tokens and their prices for SpaceLink marketplace
 */
contract TokenRegistry is Ownable, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Roles ============

    bytes32 public constant PRICE_UPDATER_ROLE = keccak256("PRICE_UPDATER_ROLE");
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");

    // ============ Structs ============

    struct TokenInfo {
        address tokenAddress;
        string symbol;
        string name;
        uint8 decimals;
        bool supported;
        uint256 price; // Price in CTC wei per token unit (scaled by 1e18)
        uint256 lastUpdate;
        bool active;
        uint256 oracleConfidence; // Confidence score from oracle
        bytes32 lastQueryId; // Last oracle query ID
    }

    // ============ State Variables ============

    /// @notice CTC token address (native token)
    address public constant CTC = address(0);

    /// @notice CTC price (always 1e18 for 1 CTC)
    uint256 public constant CTC_PRICE = 1e18;

    /// @notice Price Oracle Aggregator contract
    PriceOracleAggregator public priceOracle;

    /// @notice Mapping of token address to token info
    mapping(address => TokenInfo) public tokenInfo;

    /// @notice Array of supported token addresses
    address[] public supportedTokens;

    /// @notice Minimum time between price updates (1 hour)
    uint256 public constant MIN_UPDATE_INTERVAL = 1 hours;

    /// @notice Maximum price deviation allowed (10%)
    uint256 public constant MAX_PRICE_DEVIATION = 1000; // 10% in basis points

    /// @notice Minimum oracle confidence required (70%)
    uint256 public constant MIN_ORACLE_CONFIDENCE = 70;

    // ============ Events ============

    event TokenAdded(address indexed token, string symbol, string name, uint8 decimals);
    event TokenRemoved(address indexed token);
    event TokenSupported(address indexed token, bool supported);
    event PriceUpdated(address indexed token, uint256 oldPrice, uint256 newPrice, address updater);
    event TokenActivated(address indexed token, bool active);

    // ============ Errors ============

    error TokenAlreadyExists();
    error TokenNotFound();
    error InvalidTokenAddress();
    error PriceUpdateTooFrequent();
    error PriceDeviationTooHigh();
    error InvalidPrice();

    // ============ Constructor ============

    constructor(address _priceOracle) {
        require(_priceOracle != address(0), "Invalid price oracle");

        priceOracle = PriceOracleAggregator(_priceOracle);

        _transferOwnership(msg.sender);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PRICE_UPDATER_ROLE, msg.sender);
        _grantRole(ORACLE_MANAGER_ROLE, msg.sender);

        // Initialize CTC as supported token
        tokenInfo[CTC] = TokenInfo({
            tokenAddress: CTC,
            symbol: "CTC",
            name: "Creditcoin",
            decimals: 18,
            supported: true,
            price: CTC_PRICE,
            lastUpdate: block.timestamp,
            active: true,
            oracleConfidence: 100, // CTC price is fixed
            lastQueryId: bytes32(0)
        });

        supportedTokens.push(CTC);
    }

    // ============ Core Functions ============

    /**
     * @notice Add a new token to the registry
     * @param _tokenAddress ERC-20 token address
     * @param _symbol Token symbol
     * @param _name Token name
     * @param _decimals Token decimals
     * @param _initialPrice Initial price in CTC wei per token unit
     */
    function addToken(
        address _tokenAddress,
        string memory _symbol,
        string memory _name,
        uint8 _decimals,
        uint256 _initialPrice
    ) external onlyOwner {
        if (_tokenAddress == address(0)) revert InvalidTokenAddress();
        if (tokenInfo[_tokenAddress].tokenAddress != address(0)) revert TokenAlreadyExists();
        if (_initialPrice == 0) revert InvalidPrice();

        tokenInfo[_tokenAddress] = TokenInfo({
            tokenAddress: _tokenAddress,
            symbol: _symbol,
            name: _name,
            decimals: _decimals,
            supported: false, // Not supported by default
            price: _initialPrice,
            lastUpdate: block.timestamp,
            active: true,
            oracleConfidence: 0, // Will be updated by oracle
            lastQueryId: bytes32(0)
        });

        supportedTokens.push(_tokenAddress);

        emit TokenAdded(_tokenAddress, _symbol, _name, _decimals);
        emit PriceUpdated(_tokenAddress, 0, _initialPrice, msg.sender);
    }

    /**
     * @notice Remove a token from the registry
     * @param _tokenAddress Token address to remove
     */
    function removeToken(address _tokenAddress) external onlyOwner {
        if (tokenInfo[_tokenAddress].tokenAddress == address(0)) revert TokenNotFound();
        if (_tokenAddress == CTC) revert InvalidTokenAddress(); // Cannot remove CTC

        // Remove from supported tokens array
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == _tokenAddress) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }

        delete tokenInfo[_tokenAddress];

        emit TokenRemoved(_tokenAddress);
    }

    /**
     * @notice Update token support status
     * @param _tokenAddress Token address
     * @param _supported Whether token is supported for payments
     */
    function setTokenSupported(address _tokenAddress, bool _supported) external onlyOwner {
        if (tokenInfo[_tokenAddress].tokenAddress == address(0)) revert TokenNotFound();

        tokenInfo[_tokenAddress].supported = _supported;

        emit TokenSupported(_tokenAddress, _supported);
    }

    /**
     * @notice Update token price from oracle (anyone can call)
     * @param _tokenAddress Token address
     */
    function updatePriceFromOracle(address _tokenAddress) external whenNotPaused {
        require(priceOracle.isTokenSupported(_tokenAddress), "Token not supported by oracle");

        (uint256 oraclePrice, uint256 timestamp, uint256 confidence) = priceOracle.getPrice(_tokenAddress);

        require(confidence >= MIN_ORACLE_CONFIDENCE, "Insufficient oracle confidence");
        require(block.timestamp - timestamp <= MIN_UPDATE_INTERVAL, "Oracle data too old");

        TokenInfo storage token = tokenInfo[_tokenAddress];

        // Check price deviation for safety
        if (token.price > 0) {
            uint256 deviation = _calculateDeviation(token.price, oraclePrice);
            if (deviation > MAX_PRICE_DEVIATION) {
                revert PriceDeviationTooHigh();
            }
        }

        uint256 oldPrice = token.price;
        token.price = oraclePrice;
        token.lastUpdate = timestamp;
        token.oracleConfidence = confidence;
        // Note: queryId tracking removed for simplified oracle integration
        // token.lastQueryId = priceOracle.tokenPrices(_tokenAddress).queryId;

        emit PriceUpdated(_tokenAddress, oldPrice, oraclePrice, msg.sender);
    }

    /**
     * @notice Update prices for all supported tokens from oracle
     */
    function updateAllPricesFromOracle() external whenNotPaused {
        address[] memory tokens = priceOracle.getSupportedTokens();

        for (uint256 i = 0; i < tokens.length; i++) {
            address tokenAddr = tokens[i];
            if (tokenInfo[tokenAddr].tokenAddress != address(0) && tokenInfo[tokenAddr].active) {
                try this.updatePriceFromOracle(tokenAddr) {
                    // Price updated successfully
                } catch {
                    // Skip failed updates - don't revert entire batch
                    continue;
                }
            }
        }
    }

    /**
     * @notice Emergency manual price update (governance only)
     * @param _tokenAddress Token address
     * @param _newPrice New price in CTC wei per token unit
     */
    function emergencyUpdatePrice(address _tokenAddress, uint256 _newPrice)
        external
        onlyRole(PRICE_UPDATER_ROLE)
        whenNotPaused
    {
        if (tokenInfo[_tokenAddress].tokenAddress == address(0)) revert TokenNotFound();
        if (_tokenAddress == CTC) revert InvalidTokenAddress(); // CTC price is fixed
        if (_newPrice == 0) revert InvalidPrice();

        TokenInfo storage token = tokenInfo[_tokenAddress];

        uint256 oldPrice = token.price;
        token.price = _newPrice;
        token.lastUpdate = block.timestamp;
        token.oracleConfidence = 0; // Manual update
        token.lastQueryId = bytes32(0);

        emit PriceUpdated(_tokenAddress, oldPrice, _newPrice, msg.sender);
    }

    /**
     * @notice Set token active status
     * @param _tokenAddress Token address
     * @param _active Whether token is active
     */
    function setTokenActive(address _tokenAddress, bool _active) external onlyOwner {
        if (tokenInfo[_tokenAddress].tokenAddress == address(0)) revert TokenNotFound();

        tokenInfo[_tokenAddress].active = _active;

        emit TokenActivated(_tokenAddress, _active);
    }

    // ============ Oracle Management Functions ============

    /**
     * @notice Update price oracle address (governance only)
     * @param _newOracle New price oracle address
     */
    function setPriceOracle(address _newOracle) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newOracle != address(0), "Invalid oracle address");
        priceOracle = PriceOracleAggregator(_newOracle);
    }

    /**
     * @notice Sync token with oracle configuration
     * @param _tokenAddress Token address to sync
     * @param _chainId Source chain ID
     * @param _priceFeed Price feed contract on source chain
     * @param _minConfidence Minimum confidence required
     */
    function syncTokenWithOracle(
        address _tokenAddress,
        uint256 _chainId,
        address _priceFeed,
        uint256 _minConfidence
    ) external onlyRole(ORACLE_MANAGER_ROLE) {
        require(tokenInfo[_tokenAddress].tokenAddress != address(0), "Token not registered");

        // Add token to oracle if not already present
        if (!priceOracle.isTokenSupported(_tokenAddress)) {
            priceOracle.addToken(_tokenAddress, _chainId, _priceFeed, _minConfidence);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get token price in CTC wei
     * @param _tokenAddress Token address
     * @return uint256 Price scaled by 1e18
     */
    function getTokenPrice(address _tokenAddress) external view returns (uint256) {
        if (_tokenAddress == CTC) return CTC_PRICE;
        if (tokenInfo[_tokenAddress].tokenAddress == address(0)) revert TokenNotFound();

        TokenInfo memory token = tokenInfo[_tokenAddress];
        if (!token.active) return 0;

        return token.price;
    }

    /**
     * @notice Check if token is supported for payments
     * @param _tokenAddress Token address
     * @return bool True if supported
     */
    function isSupportedToken(address _tokenAddress) external view returns (bool) {
        if (_tokenAddress == CTC) return true;
        if (tokenInfo[_tokenAddress].tokenAddress == address(0)) return false;

        TokenInfo memory token = tokenInfo[_tokenAddress];
        return token.supported && token.active;
    }

    /**
     * @notice Get complete token information
     * @param _tokenAddress Token address
     * @return TokenInfo struct
     */
    function getTokenInfo(address _tokenAddress) external view returns (TokenInfo memory) {
        if (_tokenAddress == CTC) {
            return tokenInfo[CTC];
        }
        if (tokenInfo[_tokenAddress].tokenAddress == address(0)) revert TokenNotFound();
        return tokenInfo[_tokenAddress];
    }

    /**
     * @notice Get oracle confidence for a token
     * @param _tokenAddress Token address
     * @return uint256 Oracle confidence score
     */
    function getOracleConfidence(address _tokenAddress) external view returns (uint256) {
        if (_tokenAddress == CTC) return 100; // CTC has fixed confidence
        if (tokenInfo[_tokenAddress].tokenAddress == address(0)) revert TokenNotFound();
        return tokenInfo[_tokenAddress].oracleConfidence;
    }

    /**
     * @notice Get all supported tokens
     * @return address[] Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (tokenInfo[supportedTokens[i]].supported && tokenInfo[supportedTokens[i]].active) {
                count++;
            }
        }

        address[] memory result = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (tokenInfo[supportedTokens[i]].supported && tokenInfo[supportedTokens[i]].active) {
                result[index] = supportedTokens[i];
                index++;
            }
        }

        return result;
    }

    /**
     * @notice Get all registered tokens
     * @return address[] Array of all token addresses
     */
    function getAllTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    /**
     * @notice Convert token amount to CTC value
     * @param _tokenAddress Token address
     * @param _amount Token amount (in token's smallest unit)
     * @return uint256 Equivalent CTC amount (in wei)
     */
    function convertToCTC(address _tokenAddress, uint256 _amount) external view returns (uint256) {
        if (_amount == 0) return 0;

        uint256 price = this.getTokenPrice(_tokenAddress);
        if (price == 0) return 0;

        TokenInfo memory token = tokenInfo[_tokenAddress];
        if (token.decimals == 18) {
            return (_amount * price) / 1e18;
        } else {
            // Adjust for different decimal places
            uint256 adjustedAmount = _amount * (10 ** (18 - token.decimals));
            return (adjustedAmount * price) / 1e18;
        }
    }

    /**
     * @notice Convert CTC amount to token value
     * @param _tokenAddress Token address
     * @param _ctcAmount CTC amount in wei
     * @return uint256 Equivalent token amount
     */
    function convertFromCTC(address _tokenAddress, uint256 _ctcAmount) external view returns (uint256) {
        if (_ctcAmount == 0) return 0;

        uint256 price = this.getTokenPrice(_tokenAddress);
        if (price == 0) return 0;

        TokenInfo memory token = tokenInfo[_tokenAddress];
        uint256 tokenAmount = (_ctcAmount * 1e18) / price;

        if (token.decimals == 18) {
            return tokenAmount;
        } else {
            // Adjust for different decimal places
            return tokenAmount / (10 ** (18 - token.decimals));
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Emergency withdrawal of stuck tokens
     * @param _token Token address (address(0) for CTC)
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        if (_token == address(0)) {
            (bool success,) = payable(owner()).call{value: _amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(_token).safeTransfer(owner(), _amount);
        }
    }

    /**
     * @notice Pause contract
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

    // ============ Internal Functions ============

    /**
     * @notice Calculate price deviation in basis points
     * @param _oldPrice Old price
     * @param _newPrice New price
     * @return uint256 Deviation in basis points
     */
    function _calculateDeviation(uint256 _oldPrice, uint256 _newPrice) internal pure returns (uint256) {
        if (_oldPrice == 0) return 0;

        uint256 diff = _oldPrice > _newPrice ? _oldPrice - _newPrice : _newPrice - _oldPrice;
        return (diff * 10000) / _oldPrice;
    }

    // ============ Fallback ============

    receive() external payable {
        // Accept CTC deposits
    }
}