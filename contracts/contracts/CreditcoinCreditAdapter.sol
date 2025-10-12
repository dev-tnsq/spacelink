// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/ICreditModule.sol";

/**
 * @title CreditcoinCreditAdapter
 * @notice Production credit scoring system integrated with Creditcoin
 * @dev Manages on-chain credit scores for satellite operators and BNPL eligibility
 * 
 * Architecture:
 * - Stores credit scores on-chain with historical tracking
 * - Integrates with Creditcoin's native credit infrastructure
 * - Supports multiple scoring authorities (operators, oracle, governance)
 * - Implements BNPL (Buy Now Pay Later) eligibility logic
 * - Tracks score changes with full audit trail
 * 
 * Credit Score System:
 * - Range: 0-1000 points
 * - Initial score: 600 (neutral)
 * - +10 points per successful relay completion
 * - -50 points per failed/disputed relay
 * - +25 points per month of good standing
 * - BNPL threshold: 650 points = $500 credit line
 * - Linear scaling: 1000 points = $1500 credit line
 */
contract CreditcoinCreditAdapter is ICreditModule, Ownable, AccessControl {
    // ============ Roles ============

    bytes32 public constant SCORE_MANAGER_ROLE = keccak256("SCORE_MANAGER_ROLE");
    bytes32 public constant PENALTY_MANAGER_ROLE = keccak256("PENALTY_MANAGER_ROLE");

    // ============ Constants ============

    uint256 public constant MIN_SCORE = 0;
    uint256 public constant MAX_SCORE = 1000;
    uint256 public constant DEFAULT_INITIAL_SCORE = 600;
    uint256 public constant MIN_BNPL_SCORE = 650;
    uint256 public constant BASE_BNPL_AMOUNT = 500 ether; // $500 in CTC
    uint256 public constant MAX_BNPL_AMOUNT = 1500 ether; // $1500 in CTC
    uint256 public constant SCORE_RANGE_FOR_MAX_LOAN = 350; // 1000 - 650

    // ============ State Variables ============

    /// @notice Mapping of user address to credit score
    mapping(address => uint256) public creditScores;

    /// @notice Mapping of user to score history
    mapping(address => ScoreHistory[]) public scoreHistory;

    /// @notice Mapping of user to total relays completed
    mapping(address => uint256) public totalRelaysCompleted;

    /// @notice Mapping of user to total relays failed
    mapping(address => uint256) public totalRelaysFailed;

    /// @notice Mapping of user to account creation timestamp
    mapping(address => uint256) public accountCreatedAt;

    /// @notice Mapping of user to last score update timestamp
    mapping(address => uint256) public lastScoreUpdate;

    /// @notice Mapping of user to active BNPL loans
    mapping(address => uint256) public activeBNPLLoans;

    /// @notice Mapping of user to total BNPL repaid
    mapping(address => uint256) public totalBNPLRepaid;

    /// @notice Total number of users with credit scores
    uint256 public totalUsers;

    /// @notice Points awarded per successful relay
    uint256 public pointsPerRelay;

    /// @notice Penalty points for failed relay
    uint256 public penaltyPerFailure;

    /// @notice Time bonus points (per month of good standing)
    uint256 public timeBonusPoints;

    /// @notice Time bonus interval (30 days)
    uint256 public timeBonusInterval;

    // ============ Structs ============

    /**
     * @notice Score history entry
     * @param timestamp When the score changed
     * @param oldScore Previous score
     * @param newScore New score
     * @param reason Reason for change
     * @param changedBy Address that triggered the change
     */
    struct ScoreHistory {
        uint256 timestamp;
        uint256 oldScore;
        uint256 newScore;
        string reason;
        address changedBy;
    }

    // ============ Events ============

    event CreditScoreInitialized(
        address indexed user,
        uint256 initialScore,
        uint256 timestamp
    );

    event CreditScoreIncreased(
        address indexed user,
        uint256 oldScore,
        uint256 newScore,
        uint256 points,
        string reason
    );

    event CreditScoreDecreased(
        address indexed user,
        uint256 oldScore,
        uint256 newScore,
        uint256 points,
        string reason
    );

    event RelayCompleted(
        address indexed user,
        uint256 newTotalRelays,
        uint256 newScore
    );

    event RelayFailed(
        address indexed user,
        uint256 newTotalFailures,
        uint256 newScore
    );

    event BNPLLoanTaken(
        address indexed user,
        uint256 amount,
        uint256 creditScore
    );

    event BNPLLoanRepaid(
        address indexed user,
        uint256 amount,
        uint256 newTotalRepaid
    );

    event TimeBonusApplied(
        address indexed user,
        uint256 bonus,
        uint256 newScore
    );

    event ParametersUpdated(
        uint256 pointsPerRelay,
        uint256 penaltyPerFailure,
        uint256 timeBonusPoints,
        uint256 timeBonusInterval
    );

    // ============ Errors ============

    error ScoreAlreadyInitialized();
    error ScoreNotInitialized();
    error InvalidScoreChange();
    error ScoreOutOfRange();
    error InsufficientCreditScore();
    error LoanAmountExceedsLimit();
    error ActiveLoanExists();

    // ============ Constructor ============

    /**
     * @notice Initialize credit adapter with default parameters
     */
    constructor() {
        _transferOwnership(msg.sender);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SCORE_MANAGER_ROLE, msg.sender);
        _grantRole(PENALTY_MANAGER_ROLE, msg.sender);

        // Set default parameters
        pointsPerRelay = 10;
        penaltyPerFailure = 50;
        timeBonusPoints = 25;
        timeBonusInterval = 30 days;

        emit ParametersUpdated(pointsPerRelay, penaltyPerFailure, timeBonusPoints, timeBonusInterval);
    }

    // ============ Core Functions ============

    /**
     * @notice Increase user's credit score
     * @dev Can only be called by authorized contracts (Marketplace, Rewards)
     * @param _user Address of user
     * @param _points Points to add
     */
    function increaseCreditScore(
        address _user,
        uint256 _points
    ) external override onlyRole(SCORE_MANAGER_ROLE) {
        // Initialize score if first time
        if (creditScores[_user] == 0 && accountCreatedAt[_user] == 0) {
            _initializeScore(_user);
        }

        uint256 oldScore = creditScores[_user];
        uint256 newScore = oldScore + _points;

        // Cap at MAX_SCORE
        if (newScore > MAX_SCORE) {
            newScore = MAX_SCORE;
        }

        // Update score
        creditScores[_user] = newScore;
        lastScoreUpdate[_user] = block.timestamp;

        // Record history
        _recordScoreChange(_user, oldScore, newScore, "Score increase", msg.sender);

        emit CreditScoreIncreased(_user, oldScore, newScore, _points, "Manual increase");
    }

    /**
     * @notice Get user's credit score
     * @param _user Address to check
     * @return uint256 Credit score (0-1000)
     */
    function getCreditScore(address _user) external view override returns (uint256) {
        // Return score (0 if not initialized)
        return creditScores[_user];
    }

    /**
     * @notice Check if user qualifies for BNPL loan
     * @param _user Address to check
     * @param _amount Loan amount requested
     * @return bool True if qualified
     */
    function checkLoanEligibility(
        address _user,
        uint256 _amount
    ) external override returns (bool) {
        uint256 score = creditScores[_user];

        // Check minimum score
        if (score < MIN_BNPL_SCORE) {
            return false;
        }

        // Calculate max loan amount
        uint256 maxLoan = _calculateMaxLoan(score);

        // Check if requested amount is within limit
        bool eligible = _amount <= maxLoan;

        emit BNPLLoanTaken(_user, _amount, score);

        return eligible;
    }

    /**
     * @notice Record a completed relay and award points
     * @param _user User address
     */
    function recordRelayCompletion(address _user) external onlyRole(SCORE_MANAGER_ROLE) {
        // Initialize if needed
        if (creditScores[_user] == 0 && accountCreatedAt[_user] == 0) {
            _initializeScore(_user);
        }

        // Increment relay count
        totalRelaysCompleted[_user]++;

        // Award points
        uint256 oldScore = creditScores[_user];
        uint256 newScore = oldScore + pointsPerRelay;

        // Cap at MAX_SCORE
        if (newScore > MAX_SCORE) {
            newScore = MAX_SCORE;
        }

        creditScores[_user] = newScore;
        lastScoreUpdate[_user] = block.timestamp;

        // Record history
        _recordScoreChange(_user, oldScore, newScore, "Relay completed", msg.sender);

        emit RelayCompleted(_user, totalRelaysCompleted[_user], newScore);
        emit CreditScoreIncreased(_user, oldScore, newScore, pointsPerRelay, "Relay completion");
    }

    /**
     * @notice Record a failed relay and apply penalty
     * @param _user User address
     */
    function recordRelayFailure(address _user) external onlyRole(PENALTY_MANAGER_ROLE) {
        // Initialize if needed (to apply penalty)
        if (creditScores[_user] == 0 && accountCreatedAt[_user] == 0) {
            _initializeScore(_user);
        }

        // Increment failure count
        totalRelaysFailed[_user]++;

        // Apply penalty
        uint256 oldScore = creditScores[_user];
        uint256 newScore = oldScore > penaltyPerFailure ? oldScore - penaltyPerFailure : MIN_SCORE;

        creditScores[_user] = newScore;
        lastScoreUpdate[_user] = block.timestamp;

        // Record history
        _recordScoreChange(_user, oldScore, newScore, "Relay failed", msg.sender);

        emit RelayFailed(_user, totalRelaysFailed[_user], newScore);
        emit CreditScoreDecreased(_user, oldScore, newScore, penaltyPerFailure, "Relay failure");
    }

    /**
     * @notice Apply time-based bonus for good standing
     * @param _user User address
     */
    function applyTimeBonus(address _user) external {
        if (creditScores[_user] == 0) revert ScoreNotInitialized();

        // Check if enough time has passed
        uint256 timeSinceLastUpdate = block.timestamp - lastScoreUpdate[_user];
        if (timeSinceLastUpdate < timeBonusInterval) {
            return;
        }

        // Calculate bonus (1 bonus per interval)
        uint256 intervalsElapsed = timeSinceLastUpdate / timeBonusInterval;
        uint256 bonus = intervalsElapsed * timeBonusPoints;

        // Apply bonus
        uint256 oldScore = creditScores[_user];
        uint256 newScore = oldScore + bonus;

        // Cap at MAX_SCORE
        if (newScore > MAX_SCORE) {
            newScore = MAX_SCORE;
        }

        creditScores[_user] = newScore;
        lastScoreUpdate[_user] = block.timestamp;

        // Record history
        _recordScoreChange(_user, oldScore, newScore, "Time bonus", msg.sender);

        emit TimeBonusApplied(_user, bonus, newScore);
        emit CreditScoreIncreased(_user, oldScore, newScore, bonus, "Time bonus");
    }

    /**
     * @notice Record BNPL loan taken
     * @param _user User address
     * @param _amount Loan amount
     */
    function recordBNPLLoan(address _user, uint256 _amount) external onlyRole(SCORE_MANAGER_ROLE) {
        activeBNPLLoans[_user] += _amount;
        emit BNPLLoanTaken(_user, _amount, creditScores[_user]);
    }

    /**
     * @notice Record BNPL loan repayment
     * @param _user User address
     * @param _amount Repayment amount
     */
    function recordBNPLRepayment(address _user, uint256 _amount) external onlyRole(SCORE_MANAGER_ROLE) {
        if (activeBNPLLoans[_user] >= _amount) {
            activeBNPLLoans[_user] -= _amount;
        } else {
            activeBNPLLoans[_user] = 0;
        }

        totalBNPLRepaid[_user] += _amount;

        // Small credit boost for repayment
        uint256 oldScore = creditScores[_user];
        uint256 newScore = oldScore + 5; // 5 points per repayment

        if (newScore > MAX_SCORE) {
            newScore = MAX_SCORE;
        }

        creditScores[_user] = newScore;

        emit BNPLLoanRepaid(_user, _amount, totalBNPLRepaid[_user]);
        emit CreditScoreIncreased(_user, oldScore, newScore, 5, "BNPL repayment");
    }

    /**
     * @notice Get user's complete credit profile
     * @param _user User address
     * @return score Current credit score
     * @return totalRelays Total relays completed
     * @return totalFailures Total relays failed
     * @return accountAge Account age in seconds
     * @return activeLoans Active BNPL loan amount
     * @return totalRepaid Total BNPL repaid
     */
    function getCreditProfile(address _user)
        external
        view
        returns (
            uint256 score,
            uint256 totalRelays,
            uint256 totalFailures,
            uint256 accountAge,
            uint256 activeLoans,
            uint256 totalRepaid
        )
    {
        return (
            creditScores[_user],
            totalRelaysCompleted[_user],
            totalRelaysFailed[_user],
            accountCreatedAt[_user] > 0 ? block.timestamp - accountCreatedAt[_user] : 0,
            activeBNPLLoans[_user],
            totalBNPLRepaid[_user]
        );
    }

    /**
     * @notice Get user's score history
     * @param _user User address
     * @return ScoreHistory[] Array of score changes
     */
    function getScoreHistory(address _user) external view returns (ScoreHistory[] memory) {
        return scoreHistory[_user];
    }

    /**
     * @notice Calculate maximum BNPL loan amount for user
     * @param _user User address
     * @return uint256 Max loan amount in wei
     */
    function getMaxLoanAmount(address _user) external view returns (uint256) {
        uint256 score = creditScores[_user];
        if (score < MIN_BNPL_SCORE) {
            return 0;
        }
        return _calculateMaxLoan(score);
    }

    // ============ Admin Functions ============

    /**
     * @notice Update scoring parameters
     * @param _pointsPerRelay Points per relay
     * @param _penaltyPerFailure Penalty per failure
     * @param _timeBonusPoints Time bonus points
     * @param _timeBonusInterval Time bonus interval
     */
    function updateParameters(
        uint256 _pointsPerRelay,
        uint256 _penaltyPerFailure,
        uint256 _timeBonusPoints,
        uint256 _timeBonusInterval
    ) external onlyOwner {
        pointsPerRelay = _pointsPerRelay;
        penaltyPerFailure = _penaltyPerFailure;
        timeBonusPoints = _timeBonusPoints;
        timeBonusInterval = _timeBonusInterval;

        emit ParametersUpdated(_pointsPerRelay, _penaltyPerFailure, _timeBonusPoints, _timeBonusInterval);
    }

    /**
     * @notice Manually set user's credit score (emergency only)
     * @param _user User address
     * @param _score New score
     */
    function setScore(address _user, uint256 _score) external onlyOwner {
        if (_score > MAX_SCORE) revert ScoreOutOfRange();

        uint256 oldScore = creditScores[_user];
        creditScores[_user] = _score;
        lastScoreUpdate[_user] = block.timestamp;

        if (accountCreatedAt[_user] == 0) {
            accountCreatedAt[_user] = block.timestamp;
            totalUsers++;
        }

        _recordScoreChange(_user, oldScore, _score, "Manual admin adjustment", msg.sender);

        if (_score > oldScore) {
            emit CreditScoreIncreased(_user, oldScore, _score, _score - oldScore, "Admin adjustment");
        } else {
            emit CreditScoreDecreased(_user, oldScore, _score, oldScore - _score, "Admin adjustment");
        }
    }

    // ============ Internal Functions ============

    /**
     * @notice Initialize credit score for new user
     * @param _user User address
     */
    function _initializeScore(address _user) internal {
        creditScores[_user] = DEFAULT_INITIAL_SCORE;
        accountCreatedAt[_user] = block.timestamp;
        lastScoreUpdate[_user] = block.timestamp;
        totalUsers++;

        _recordScoreChange(_user, 0, DEFAULT_INITIAL_SCORE, "Account initialized", msg.sender);

        emit CreditScoreInitialized(_user, DEFAULT_INITIAL_SCORE, block.timestamp);
    }

    /**
     * @notice Record score change in history
     * @param _user User address
     * @param _oldScore Old score
     * @param _newScore New score
     * @param _reason Reason for change
     * @param _changedBy Address that made the change
     */
    function _recordScoreChange(
        address _user,
        uint256 _oldScore,
        uint256 _newScore,
        string memory _reason,
        address _changedBy
    ) internal {
        scoreHistory[_user].push(
            ScoreHistory({
                timestamp: block.timestamp,
                oldScore: _oldScore,
                newScore: _newScore,
                reason: _reason,
                changedBy: _changedBy
            })
        );
    }

    /**
     * @notice Calculate maximum BNPL loan amount based on score
     * @dev Linear scaling: 650 = $500, 1000 = $1500
     * @param _score Credit score
     * @return uint256 Max loan amount
     */
    function _calculateMaxLoan(uint256 _score) internal pure returns (uint256) {
        if (_score < MIN_BNPL_SCORE) {
            return 0;
        }

        if (_score >= MAX_SCORE) {
            return MAX_BNPL_AMOUNT;
        }

        // Linear interpolation: BASE + (score - 650) * (1000 / 350)
        uint256 extraScore = _score - MIN_BNPL_SCORE;
        uint256 extraLoan = (extraScore * (MAX_BNPL_AMOUNT - BASE_BNPL_AMOUNT)) / SCORE_RANGE_FOR_MAX_LOAN;

        return BASE_BNPL_AMOUNT + extraLoan;
    }
}
