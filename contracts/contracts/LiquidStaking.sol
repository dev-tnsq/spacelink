// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title LiquidStaking
 * @notice Liquid staking contract for CTC to sCTC conversion
 * @dev Allows staking CTC for sCTC tokens with rewards and unstaking
 */
contract LiquidStaking is ERC20, Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice Underlying CTC token
    address public constant CTC = address(0); // Native CTC

    /// @notice Exchange rate (sCTC per CTC, scaled by 1e18)
    uint256 public exchangeRate = 1e18; // 1:1 initially

    /// @notice Total CTC staked
    uint256 public totalStaked;

    /// @notice Staking rewards rate (basis points per day)
    uint256 public rewardRate = 50; // 0.5% per day

    /// @notice Unstaking cooldown period (days)
    uint256 public unstakingCooldown = 7 days;

    /// @notice Maximum unstaking amount per period
    uint256 public maxUnstakingAmount = 1000 ether;

    // ============ Mappings ============

    /// @notice Staked amount per user
    mapping(address => uint256) public stakedAmount;

    /// @notice Last reward claim time per user
    mapping(address => uint256) public lastRewardClaim;

    /// @notice Pending unstakes (amount => unlockTime)
    mapping(address => mapping(uint256 => uint256)) public pendingUnstakes;

    /// @notice Unstake request count per user
    mapping(address => uint256) public unstakeRequestCount;

    // ============ Events ============

    event Staked(address indexed user, uint256 ctcAmount, uint256 sCtcAmount);
    event Unstaked(address indexed user, uint256 sCtcAmount, uint256 ctcAmount);
    event RewardsClaimed(address indexed user, uint256 rewardAmount);
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);

    // ============ Errors ============

    error InsufficientBalance();
    error InsufficientStaked();
    error UnstakingLocked();
    error InvalidAmount();
    error CooldownActive();

    // ============ Constructor ============

    constructor()
        ERC20("Staked Creditcoin", "sCTC")
    {
        _transferOwnership(msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @notice Stake CTC for sCTC tokens
     * @param _amount Amount of CTC to stake
     */
    function stake(uint256 _amount) external payable nonReentrant whenNotPaused {
        require(_amount > 0, "Invalid amount");
        require(msg.value >= _amount, "Insufficient CTC sent");

        // Calculate sCTC to mint
        uint256 sCtcAmount = (_amount * 1e18) / exchangeRate;

        // Update state
        stakedAmount[msg.sender] += _amount;
        totalStaked += _amount;
        lastRewardClaim[msg.sender] = block.timestamp;

        // Mint sCTC tokens
        _mint(msg.sender, sCtcAmount);

        // Refund excess CTC
        if (msg.value > _amount) {
            (bool success,) = payable(msg.sender).call{value: msg.value - _amount}("");
            require(success, "Refund failed");
        }

        emit Staked(msg.sender, _amount, sCtcAmount);
    }

    /**
     * @notice Request unstaking of sCTC for CTC
     * @param _sCtcAmount Amount of sCTC to unstake
     */
    function requestUnstake(uint256 _sCtcAmount) external nonReentrant whenNotPaused {
        require(_sCtcAmount > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= _sCtcAmount, "Insufficient sCTC balance");

        uint256 requestId = ++unstakeRequestCount[msg.sender];
        uint256 unlockTime = block.timestamp + unstakingCooldown;

        pendingUnstakes[msg.sender][requestId] = unlockTime;

        emit Unstaked(msg.sender, _sCtcAmount, 0); // 0 CTC amount as it's pending
    }

    /**
     * @notice Complete unstaking after cooldown
     * @param _requestId Unstake request ID
     */
    function completeUnstake(uint256 _requestId) external nonReentrant whenNotPaused {
        uint256 unlockTime = pendingUnstakes[msg.sender][_requestId];
        require(unlockTime > 0, "Invalid request");
        require(block.timestamp >= unlockTime, "Cooldown not complete");

        // Calculate CTC to return (simplified - would include rewards)
        uint256 sCtcAmount = balanceOf(msg.sender); // Simplified
        uint256 ctcAmount = (sCtcAmount * exchangeRate) / 1e18;

        require(address(this).balance >= ctcAmount, "Insufficient contract balance");

        // Update state
        stakedAmount[msg.sender] -= ctcAmount;
        totalStaked -= ctcAmount;

        // Burn sCTC tokens
        _burn(msg.sender, sCtcAmount);

        // Clear pending unstake
        delete pendingUnstakes[msg.sender][_requestId];

        // Transfer CTC back
        (bool success,) = payable(msg.sender).call{value: ctcAmount}("");
        require(success, "Transfer failed");

        emit Unstaked(msg.sender, sCtcAmount, ctcAmount);
    }

    /**
     * @notice Claim staking rewards
     */
    function claimRewards() external nonReentrant whenNotPaused {
        uint256 rewards = calculateRewards(msg.sender);
        require(rewards > 0, "No rewards available");

        lastRewardClaim[msg.sender] = block.timestamp;

        // Mint reward sCTC tokens
        _mint(msg.sender, rewards);

        emit RewardsClaimed(msg.sender, rewards);
    }

    // ============ View Functions ============

    /**
     * @notice Get staked amount for user
     * @param _user User address
     * @return uint256 Staked CTC amount
     */
    function getStakedAmount(address _user) external view returns (uint256) {
        return stakedAmount[_user];
    }

    /**
     * @notice Calculate pending rewards for user
     * @param _user User address
     * @return uint256 Pending reward amount
     */
    function calculateRewards(address _user) public view returns (uint256) {
        uint256 staked = stakedAmount[_user];
        if (staked == 0) return 0;

        uint256 timeElapsed = block.timestamp - lastRewardClaim[_user];
        uint256 daysElapsed = timeElapsed / 1 days;

        // Rewards = staked * rate * days
        return (staked * rewardRate * daysElapsed) / 10000;
    }

    /**
     * @notice Get unstaking cooldown for user
     * @param _user User address
     * @param _requestId Request ID
     * @return uint256 Unlock timestamp
     */
    function getUnstakeUnlockTime(address _user, uint256 _requestId) external view returns (uint256) {
        return pendingUnstakes[_user][_requestId];
    }

    /**
     * @notice Get current exchange rate
     * @return uint256 sCTC per CTC (scaled by 1e18)
     */
    function getExchangeRate() external view returns (uint256) {
        return exchangeRate;
    }

    /**
     * @notice Get total value locked
     * @return uint256 Total CTC staked
     */
    function getTotalValueLocked() external view returns (uint256) {
        return totalStaked;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update exchange rate (governance controlled)
     * @param _newRate New exchange rate
     */
    function updateExchangeRate(uint256 _newRate) external onlyOwner {
        require(_newRate > 0, "Invalid rate");
        emit ExchangeRateUpdated(exchangeRate, _newRate);
        exchangeRate = _newRate;
    }

    /**
     * @notice Update reward rate
     * @param _newRate New reward rate (basis points)
     */
    function updateRewardRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= 1000, "Rate too high"); // Max 10%
        emit RewardRateUpdated(rewardRate, _newRate);
        rewardRate = _newRate;
    }

    /**
     * @notice Update unstaking cooldown
     * @param _cooldown New cooldown period
     */
    function updateUnstakingCooldown(uint256 _cooldown) external onlyOwner {
        require(_cooldown >= 1 days && _cooldown <= 30 days, "Invalid cooldown");
        unstakingCooldown = _cooldown;
    }

    /**
     * @notice Update max unstaking amount
     * @param _amount New max amount
     */
    function updateMaxUnstakingAmount(uint256 _amount) external onlyOwner {
        maxUnstakingAmount = _amount;
    }

    /**
     * @notice Deposit rewards to contract
     */
    function depositRewards() external payable onlyOwner {
        // Owner can deposit CTC for rewards distribution
    }

    /**
     * @notice Emergency withdrawal
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");
        (bool success,) = payable(owner()).call{value: _amount}("");
        require(success, "Transfer failed");
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

    receive() external payable {
        // Accept CTC deposits
    }
}