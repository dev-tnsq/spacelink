// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/ICreditModule.sol";
import "./interfaces/IIPFS.sol";

/**
 * @title Rewards
 * @notice Handles reward distribution for completed satellite relays
 * @dev Distributes 1 CTC per relay, integrates with Credit Module for +10 points
 * Supports scaling to $10M TVL by 2030
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

    /// @notice Total rewards distributed
    uint256 public totalRewardsDistributed;

    /// @notice Total relays rewarded
    uint256 public totalRelaysRewarded;

    // ============ Mappings ============

    /// @notice Tracks if pass has been claimed
    mapping(uint256 => bool) public passClaimed;

    /// @notice Tracks rewards earned by address
    mapping(address => uint256) public rewardsEarned;

    /// @notice Tracks relay count by address
    mapping(address => uint256) public relayCount;

    // ============ Events ============

    event RewardClaimed(
        address indexed node,
        uint256 indexed passId,
        uint256 amount,
        uint256 creditPoints
    );

    event RewardsFunded(
        address indexed funder,
        uint256 amount
    );

    event CreditBoosted(
        address indexed node,
        uint256 points,
        uint256 newScore
    );

    event EmergencyWithdrawal(
        address indexed owner,
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
     */
    constructor(
        address _marketplace,
        address _creditModule,
        address _ipfs
    ) {
        marketplace = _marketplace;
        creditModule = ICreditModule(_creditModule);
        ipfs = IIPFS(_ipfs);
        _transferOwnership(msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @notice Claims reward for completed and verified pass
     * @param _passId Pass ID from marketplace
     * @dev Transfers 1 CTC, adds +10 credit points, logs to Walrus
     */
    function claimReward(uint256 _passId) external nonReentrant whenNotPaused {
        // Check if already claimed
        if (passClaimed[_passId]) revert PassAlreadyClaimed();

        // Get pass details from marketplace
        (
            address operator,
            uint256 nodeId,
            uint256 satId,
            uint256 timestamp,
            uint256 durationMin,
            bool completed,
            bytes32 proofHash,
            bool verified,
            uint256 paymentAmount
        ) = _getPassDetails(_passId);

        // Validate pass status
        if (!completed) revert PassNotCompleted();
        if (!verified) revert PassNotVerified();

        // Get node owner
        address nodeOwner = _getNodeOwner(nodeId);
        if (nodeOwner != msg.sender) revert NotMarketplace();

        // Check contract balance
        if (address(this).balance < REWARD_AMOUNT) revert InsufficientBalance();

        // Mark as claimed
        passClaimed[_passId] = true;

        // Update statistics
        rewardsEarned[msg.sender] += REWARD_AMOUNT;
        relayCount[msg.sender]++;
        totalRewardsDistributed += REWARD_AMOUNT;
        totalRelaysRewarded++;

        // Boost credit score
        creditModule.increaseCreditScore(msg.sender, CREDIT_POINTS_PER_RELAY);
        uint256 newScore = creditModule.getCreditScore(msg.sender);

        // Note: Reward logs can be tracked via events or stored off-chain in IPFS
        // Frontend can upload log data to IPFS if needed for historical tracking

        // Transfer reward
        (bool success, ) = payable(msg.sender).call{value: REWARD_AMOUNT}("");
        if (!success) revert TransferFailed();

        emit RewardClaimed(msg.sender, _passId, REWARD_AMOUNT, CREDIT_POINTS_PER_RELAY);
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

        // Check contract balance
        if (address(this).balance < REWARD_AMOUNT) revert InsufficientBalance();

        // Mark as claimed
        passClaimed[_passId] = true;

        // Update statistics
        rewardsEarned[_nodeOwner] += REWARD_AMOUNT;
        relayCount[_nodeOwner]++;
        totalRewardsDistributed += REWARD_AMOUNT;
        totalRelaysRewarded++;

        // Boost credit score
        creditModule.increaseCreditScore(_nodeOwner, CREDIT_POINTS_PER_RELAY);
        uint256 newScore = creditModule.getCreditScore(_nodeOwner);

        // Note: Reward logs can be tracked via events or stored off-chain in IPFS
        // Frontend can upload log data to IPFS if needed for historical tracking

        // Transfer reward
        (bool success, ) = payable(_nodeOwner).call{value: REWARD_AMOUNT}("");
        if (!success) revert TransferFailed();

        emit RewardClaimed(_nodeOwner, _passId, REWARD_AMOUNT, CREDIT_POINTS_PER_RELAY);
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
     * @return completed Whether the pass is completed
     * @return proofHash The proof hash
     * @return verified Whether the pass is verified
     * @return paymentAmount The payment amount
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
            bool completed,
            bytes32 proofHash,
            bool verified,
            uint256 paymentAmount
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
            completed,
            proofHash,
            verified,
            paymentAmount
        ) = abi.decode(
            data,
            (address, uint256, uint256, uint256, uint256, bool, bytes32, bool, uint256)
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
     * @notice Gets total rewards earned by address
     * @param _node Node operator address
     * @return uint256 Total rewards earned
     */
    function getRewardsEarned(address _node) external view returns (uint256) {
        return rewardsEarned[_node];
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
     * @return uint256 Balance in wei
     */
    function getAvailableBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Gets total distributed statistics
     * @return totalDistributed Total CTC distributed
     * @return totalRelays Total relays rewarded
     */
    function getStatistics()
        external
        view
        returns (uint256 totalDistributed, uint256 totalRelays)
    {
        return (totalRewardsDistributed, totalRelaysRewarded);
    }

    // ============ Admin Functions ============

    /**
     * @notice Funds rewards pool
     * @dev Anyone can fund, typically from marketplace fees or treasury
     */
    function fundRewards() external payable {
        require(msg.value > 0, "Must send CTC");
        emit RewardsFunded(msg.sender, msg.value);
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
     * @notice Updates IPFS address (owner only)
     * @param _ipfs New IPFS address
     */
    function updateIPFS(address _ipfs) external onlyOwner {
        require(_ipfs != address(0), "Invalid IPFS address");
        emit IPFSUpdated(address(ipfs), _ipfs);
        ipfs = IIPFS(_ipfs);
    }

    /**
     * @notice Emergency withdrawal (owner only, for migration)
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");

        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "Transfer failed");

        emit EmergencyWithdrawal(owner(), _amount);
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
        emit RewardsFunded(msg.sender, msg.value);
    }
}
