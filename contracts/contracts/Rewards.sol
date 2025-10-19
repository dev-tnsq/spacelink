// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ICreditModule.sol";
import "./interfaces/IIPFS.sol";
import "./interfaces/IPaymentRouter.sol";

/**
 * @title Rewards
 * @notice Handles multi-token reward distribution for completed satellite relays
 * @dev Supports CTC, sCTC, and other tokens via PaymentRouter
 * Integrates with Credit Module for scoring and BNPL rewards
 */
contract Rewards is Ownable, ReentrancyGuard, Pausable {
    // ============ State Variables ============

    /// @notice Standard reward per relay (1 CTC)
    uint256 public constant REWARD_AMOUNT = 1 ether;

    /// @notice Credit points per relay
    uint256 public constant CREDIT_POINTS_PER_RELAY = 10;

    /// @notice Marketplace contract address
    address public marketplace;

    /// @notice Credit module for scoring
    ICreditModule public creditModule;

    /// @notice IPFS for logging
    IIPFS public ipfs;

    /// @notice Payment router for multi-token transfers
    IPaymentRouter public paymentRouter;

    /// @notice Total rewards distributed (by token)
    mapping(address => uint256) public totalRewardsDistributed;

    /// @notice Total relays rewarded
    uint256 public totalRelaysRewarded;

    /// @notice Default payout token (CTC)
    address public defaultPayoutToken;

    // ============ Mappings ============

    /// @notice Tracks if pass has been claimed
    mapping(uint256 => bool) public passClaimed;

    /// @notice Tracks rewards earned by address (by token)
    mapping(address => mapping(address => uint256)) public rewardsEarned;

    /// @notice Tracks relay count by address
    mapping(address => uint256) public relayCount;

    /// @notice Preferred payout token per node operator
    mapping(address => address) public preferredPayoutToken;

    // ============ Events ============

    event RewardClaimed(
        address indexed node,
        uint256 indexed passId,
        address indexed token,
        uint256 amount,
        uint256 creditPoints
    );

    event RewardsFunded(
        address indexed funder,
        address indexed token,
        uint256 amount
    );

    event CreditBoosted(
        address indexed node,
        uint256 points,
        uint256 newScore
    );

    event PayoutTokenUpdated(
        address indexed node,
        address indexed oldToken,
        address indexed newToken
    );

    event EmergencyWithdrawal(
        address indexed owner,
        address indexed token,
        uint256 amount
    );

    event MarketplaceUpdated(
        address indexed oldMarketplace,
        address indexed newMarketplace
    );

    event CreditModuleUpdated(
        address indexed oldModule,
        address indexed newModule
    );

    event IPFSUpdated(
        address indexed oldIPFS,
        address indexed newIPFS
    );

    event PaymentRouterUpdated(
        address indexed oldRouter,
        address indexed newRouter
    );

    // ============ Errors ============

    error PassAlreadyClaimed();
    error PassNotCompleted();
    error PassNotVerified();
    error InsufficientBalance();
    error NotMarketplace();
    error InvalidPassId();
    error TransferFailed();

    // ============ Modifiers ============

    modifier onlyMarketplace() {
        if (msg.sender != marketplace) revert NotMarketplace();
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initializes rewards contract
     * @param _marketplace Marketplace contract address
     * @param _creditModule Credit module address
     * @param _ipfs IPFS storage address
     * @param _paymentRouter Payment router for multi-token transfers
     * @param _defaultPayoutToken Default payout token (CTC)
     */
    constructor(
        address _marketplace,
        address _creditModule,
        address _ipfs,
        address _paymentRouter,
        address _defaultPayoutToken
    ) {
        marketplace = _marketplace;
        creditModule = ICreditModule(_creditModule);
        ipfs = IIPFS(_ipfs);
        paymentRouter = IPaymentRouter(_paymentRouter);
        defaultPayoutToken = _defaultPayoutToken;
        _transferOwnership(msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @notice Claims reward for completed and verified pass
     * @param _passId Pass ID from marketplace
     * @dev Transfers reward in preferred token, adds credit points, logs to IPFS
     * Supports BNPL multiplier for users with active loans
     */
    function claimReward(uint256 _passId) external nonReentrant whenNotPaused {
        // Check if already claimed
        if (passClaimed[_passId]) revert PassAlreadyClaimed();

        // Get pass details from marketplace
        (
            ,
            uint256 nodeId,
            ,
            ,
            ,
            uint8 state,
            ,
            ,
            ,
            bool verified,
            ,
            ,
            ,
            
        ) = _getPassDetails(_passId);

        // Validate pass status (state 2 = completed)
        if (state != 2) revert PassNotCompleted();
        if (!verified) revert PassNotVerified();

        // Get node owner
        address nodeOwner = _getNodeOwner(nodeId);
        if (nodeOwner != msg.sender) revert NotMarketplace();

        // Determine payout token and amount
        address payoutToken = preferredPayoutToken[msg.sender];
        if (payoutToken == address(0)) {
            payoutToken = defaultPayoutToken;
        }

        uint256 rewardAmount = REWARD_AMOUNT;

        // Check contract balance for token
        if (payoutToken == address(0)) {
            // Native CTC
            if (address(this).balance < rewardAmount) revert InsufficientBalance();
        } else {
            // ERC20 token
            if (IERC20(payoutToken).balanceOf(address(this)) < rewardAmount) revert InsufficientBalance();
        }

        // Mark as claimed
        passClaimed[_passId] = true;

        // Update statistics
        rewardsEarned[msg.sender][payoutToken] += rewardAmount;
        relayCount[msg.sender]++;
        totalRewardsDistributed[payoutToken] += rewardAmount;
        totalRelaysRewarded++;

        // Boost credit score
        creditModule.increaseCreditScore(msg.sender, CREDIT_POINTS_PER_RELAY);
        uint256 newScore = creditModule.getCreditScore(msg.sender);

        // Transfer reward via PaymentRouter
        IPaymentRouter(paymentRouter).routePayment(payoutToken, address(this), msg.sender, rewardAmount);

        emit RewardClaimed(msg.sender, _passId, payoutToken, rewardAmount, CREDIT_POINTS_PER_RELAY);
        emit CreditBoosted(msg.sender, CREDIT_POINTS_PER_RELAY, newScore);
    }

    /**
     * @notice Allows marketplace to trigger rewards automatically
     * @param _passId Pass ID
     * @param _nodeOwner Node owner address
     * @dev Can be called by marketplace contract after verification
     */
    function distributeReward(
        uint256 _passId,
        address _nodeOwner
    ) external nonReentrant onlyMarketplace whenNotPaused {
        // Check if already claimed
        if (passClaimed[_passId]) revert PassAlreadyClaimed();

        // Determine payout token and amount
        address payoutToken = preferredPayoutToken[_nodeOwner];
        if (payoutToken == address(0)) {
            payoutToken = defaultPayoutToken;
        }

        uint256 rewardAmount = REWARD_AMOUNT;

        // Check contract balance for token
        if (payoutToken == address(0)) {
            // Native CTC
            if (address(this).balance < rewardAmount) revert InsufficientBalance();
        } else {
            // ERC20 token
            if (IERC20(payoutToken).balanceOf(address(this)) < rewardAmount) revert InsufficientBalance();
        }

        // Mark as claimed
        passClaimed[_passId] = true;

        // Update statistics
        rewardsEarned[_nodeOwner][payoutToken] += rewardAmount;
        relayCount[_nodeOwner]++;
        totalRewardsDistributed[payoutToken] += rewardAmount;
        totalRelaysRewarded++;

        // Boost credit score
        creditModule.increaseCreditScore(_nodeOwner, CREDIT_POINTS_PER_RELAY);
        uint256 newScore = creditModule.getCreditScore(_nodeOwner);

        // Transfer reward via PaymentRouter
        IPaymentRouter(paymentRouter).routePayment(payoutToken, address(this), _nodeOwner, rewardAmount);

        emit RewardClaimed(_nodeOwner, _passId, payoutToken, rewardAmount, CREDIT_POINTS_PER_RELAY);
        emit CreditBoosted(_nodeOwner, CREDIT_POINTS_PER_RELAY, newScore);
    }

    // ============ Internal Functions ============

    /**
     * @notice Gets pass details from marketplace
     * @param _passId Pass ID
     * @return operator The operator address
     * @return nodeId The node ID
     * @return satId The satellite ID
     * @return timestamp The pass timestamp
     * @return durationMin The duration in minutes
     * @return state The pass state (0=booked, 1=active, 2=completed, 3=failed)
     * @return paymentToken The payment token address
     * @return paymentAmount The payment amount
     * @return proofCID The IPFS proof CID
     * @return verified Whether the pass is verified
     * @return snr Signal-to-noise ratio
     * @return ber Bit error rate
     * @return metadataCID IPFS metadata CID
     * @return tleSnapshotHash TLE snapshot hash
     */
    function _getPassDetails(uint256 _passId)
        internal
        view
        returns (
            address operator,
            uint256 nodeId,
            uint256 satId,
            uint256 timestamp,
            uint256 durationMin,
            uint8 state,
            address paymentToken,
            uint256 paymentAmount,
            string memory proofCID,
            bool verified,
            uint256 snr,
            uint256 ber,
            string memory metadataCID,
            bytes32 tleSnapshotHash
        )
    {
        // Call marketplace contract to get pass
        (bool success, bytes memory data) = marketplace.staticcall(
            abi.encodeWithSignature("getPass(uint256)", _passId)
        );
        require(success, "Failed to get pass");

        (
            operator,
            nodeId,
            satId,
            timestamp,
            durationMin,
            state,
            paymentToken,
            paymentAmount,
            proofCID,
            verified,
            snr,
            ber,
            metadataCID,
            tleSnapshotHash
        ) = abi.decode(
            data,
            (address, uint256, uint256, uint256, uint256, uint8, address, uint256, string, bool, uint256, uint256, string, bytes32)
        );
    }

    /**
     * @notice Gets node owner from marketplace
     * @param _nodeId Node ID
     * @return address Node owner
     */
    function _getNodeOwner(uint256 _nodeId) internal view returns (address) {
        (bool success, bytes memory data) = marketplace.staticcall(
            abi.encodeWithSignature("getNode(uint256)", _nodeId)
        );
        require(success, "Failed to get node");

        // Decode only the owner field (first in struct)
        address owner = abi.decode(data, (address));
        return owner;
    }

    // ============ View Functions ============

    /**
     * @notice Gets total rewards earned by address for specific token
     * @param _node Node operator address
     * @param _token Token address (address(0) for native CTC)
     * @return uint256 Total rewards earned in token
     */
    function getRewardsEarned(address _node, address _token) external view returns (uint256) {
        return rewardsEarned[_node][_token];
    }

    /**
     * @notice Gets total rewards earned by address across all tokens
     * @param _node Node operator address
     * @return uint256 Total rewards earned (legacy function for CTC only)
     */
    function getRewardsEarned(address _node) external view returns (uint256) {
        return rewardsEarned[_node][address(0)];
    }

    /**
     * @notice Gets total relays completed by address
     * @param _node Node operator address
     * @return uint256 Total relays
     */
    function getRelayCount(address _node) external view returns (uint256) {
        return relayCount[_node];
    }

    /**
     * @notice Checks if pass reward has been claimed
     * @param _passId Pass ID
     * @return bool True if claimed
     */
    function isPassClaimed(uint256 _passId) external view returns (bool) {
        return passClaimed[_passId];
    }

    /**
     * @notice Gets contract balance available for rewards
     * @param _token Token address (address(0) for native CTC)
     * @return uint256 Balance in token
     */
    function getAvailableBalance(address _token) external view returns (uint256) {
        if (_token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(_token).balanceOf(address(this));
        }
    }

    /**
     * @notice Gets contract balance available for rewards (legacy for CTC)
     * @return uint256 Balance in wei
     */
    function getAvailableBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Gets total distributed statistics
     * @return totalRelays Total relays rewarded
     */
    function getStatistics() external view returns (uint256 totalRelays) {
        return totalRelaysRewarded;
    }

    // ============ Admin Functions ============

    /**
     * @notice Funds rewards pool with native CTC
     * @dev Anyone can fund, typically from marketplace fees or treasury
     */
    function fundRewards() external payable {
        require(msg.value > 0, "Must send CTC");
        emit RewardsFunded(msg.sender, address(0), msg.value);
    }

    /**
     * @notice Funds rewards pool with ERC20 tokens
     * @param _token Token address
     * @param _amount Amount to fund
     * @dev Anyone can fund, typically from marketplace fees or treasury
     */
    function fundRewards(address _token, uint256 _amount) external {
        require(_token != address(0), "Invalid token");
        require(_amount > 0, "Must send tokens");

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        emit RewardsFunded(msg.sender, _token, _amount);
    }

    /**
     * @notice Updates marketplace address (owner only)
     * @param _marketplace New marketplace address
     */
    function updateMarketplace(address _marketplace) external onlyOwner {
        require(_marketplace != address(0), "Invalid marketplace address");
        emit MarketplaceUpdated(marketplace, _marketplace);
        marketplace = _marketplace;
    }

    /**
     * @notice Updates credit module address (owner only)
     * @param _creditModule New credit module address
     */
    function updateCreditModule(address _creditModule) external onlyOwner {
        require(_creditModule != address(0), "Invalid credit module address");
        emit CreditModuleUpdated(address(creditModule), _creditModule);
        creditModule = ICreditModule(_creditModule);
    }

    /**
     * @notice Updates payment router address (owner only)
     * @param _paymentRouter New payment router address
     */
    function updatePaymentRouter(address _paymentRouter) external onlyOwner {
        require(_paymentRouter != address(0), "Invalid payment router address");
        emit PaymentRouterUpdated(address(paymentRouter), _paymentRouter);
        paymentRouter = IPaymentRouter(_paymentRouter);
    }

    /**
     * @notice Updates default payout token (owner only)
     * @param _token New default payout token
     */
    function updateDefaultPayoutToken(address _token) external onlyOwner {
        defaultPayoutToken = _token;
    }

    /**
     * @notice Sets preferred payout token for rewards
     * @param _token Preferred token address (address(0) for native CTC)
     * @dev Node operators can set their preferred reward token
     */
    function setPreferredPayoutToken(address _token) external {
        address oldToken = preferredPayoutToken[msg.sender];
        preferredPayoutToken[msg.sender] = _token;
        emit PayoutTokenUpdated(msg.sender, oldToken, _token);
    }

    /**
     * @notice Emergency withdrawal (owner only, for migration)
     * @param _token Token address (address(0) for native CTC)
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        if (_token == address(0)) {
            // Native CTC
            require(_amount <= address(this).balance, "Insufficient balance");
            (bool success, ) = payable(owner()).call{value: _amount}("");
            require(success, "Transfer failed");
        } else {
            // ERC20 token
            require(_amount <= IERC20(_token).balanceOf(address(this)), "Insufficient balance");
            IERC20(_token).transfer(owner(), _amount);
        }

        emit EmergencyWithdrawal(owner(), _token, _amount);
    }

    /**
     * @notice Emergency withdrawal for native CTC (legacy)
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");

        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "Transfer failed");

        emit EmergencyWithdrawal(owner(), address(0), _amount);
    }

    /**
     * @notice Pauses contract (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Receives CTC for rewards pool
     */
    receive() external payable {
        emit RewardsFunded(msg.sender, address(0), msg.value);
    }
}
