// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/ICreditModule.sol";

/**
 * @title CreditHook
 * @notice Integration layer between SpaceLink and Creditcoin's Credit Module
 * @dev Manages credit score updates, BNPL eligibility, and financial inclusion
 * Enables $500 loans at 650/1000 score with +10 points per relay
 */
contract CreditHook is Ownable, ReentrancyGuard {
    // ============ State Variables ============

    /// @notice Authorized contracts that can boost credit
    mapping(address => bool) public authorizedCallers;

    /// @notice Credit module reference
    ICreditModule public creditModule;

    /// @notice Minimum score for BNPL eligibility (650 for $500 loan)
    uint256 public constant MIN_BNPL_SCORE = 650;

    /// @notice Maximum BNPL loan at minimum score
    uint256 public constant MAX_BNPL_AMOUNT = 500 ether; // $500 in CTC

    /// @notice Score scale (0-1000)
    uint256 public constant MAX_SCORE = 1000;

    // ============ Events ============

    event CreditBoosted(
        address indexed user,
        uint256 points,
        uint256 newScore,
        address indexed caller
    );

    event CallerAuthorized(
        address indexed caller,
        bool authorized
    );

    event BNPLEligibilityChecked(
        address indexed user,
        uint256 score,
        uint256 requestedAmount,
        bool eligible
    );

    event CreditModuleUpdated(
        address indexed oldModule,
        address indexed newModule
    );

    // ============ Errors ============

    error UnauthorizedCaller();
    error InvalidCreditModule();
    error InvalidScore();
    error InvalidAmount();

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }
        _;
    }

    // ============ Constructor ============

    /**
     * @notice Initializes credit hook with credit module
     * @param _creditModule Credit module address
     */
    constructor(address _creditModule) {
        if (_creditModule == address(0)) revert InvalidCreditModule();
        creditModule = ICreditModule(_creditModule);
        _transferOwnership(msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @notice Boosts credit score for user (authorized callers only)
     * @param _user User address to boost
     * @param _points Points to add (+10 per relay)
     * @dev Called by Rewards contract after successful relay
     */
    function boostCredit(
        address _user,
        uint256 _points
    ) external nonReentrant onlyAuthorized {
        require(_user != address(0), "Invalid user");
        require(_points > 0 && _points <= 100, "Invalid points");

        // Increase score via credit module
        creditModule.increaseCreditScore(_user, _points);

        // Get new score
        uint256 newScore = creditModule.getCreditScore(_user);

        emit CreditBoosted(_user, _points, newScore, msg.sender);
    }

    /**
     * @notice Checks BNPL loan eligibility based on credit score
     * @param _user User address
     * @param _amount Requested loan amount in CTC
     * @return eligible True if user qualifies for loan
     * @return currentScore User's current credit score
     * @return maxLoanAmount Maximum loan amount user qualifies for
     */
    function checkBNPLEligibility(
        address _user,
        uint256 _amount
    )
        external
        view
        returns (
            bool eligible,
            uint256 currentScore,
            uint256 maxLoanAmount
        )
    {
        require(_user != address(0), "Invalid user");
        require(_amount > 0, "Invalid amount");

        currentScore = creditModule.getCreditScore(_user);

        // Calculate max loan based on score
        // Linear scaling: 650 score = $500, 1000 score = $1500
        if (currentScore < MIN_BNPL_SCORE) {
            maxLoanAmount = 0;
            eligible = false;
        } else {
            // Formula: maxLoan = $500 + (score - 650) * ($1000 / 350)
            // At 650: $500, At 1000: $1500
            uint256 extraScore = currentScore - MIN_BNPL_SCORE;
            uint256 extraLoan = (extraScore * 1000 ether) / 350;
            maxLoanAmount = MAX_BNPL_AMOUNT + extraLoan;

            eligible = _amount <= maxLoanAmount;
        }

        return (eligible, currentScore, maxLoanAmount);
    }

    /**
     * @notice Checks eligibility using credit module's built-in check
     * @param _user User address
     * @param _amount Requested amount
     * @return bool True if eligible
     */
    function checkEligibilityViaModule(
        address _user,
        uint256 _amount
    ) external returns (bool) {
        bool eligible = creditModule.checkLoanEligibility(_user, _amount);
        uint256 score = creditModule.getCreditScore(_user);

        emit BNPLEligibilityChecked(_user, score, _amount, eligible);

        return eligible;
    }

    /**
     * @notice Gets user's current credit score
     * @param _user User address
     * @return uint256 Credit score (0-1000)
     */
    function getCreditScore(address _user) external view returns (uint256) {
        return creditModule.getCreditScore(_user);
    }

    /**
     * @notice Calculates potential score after N relays
     * @param _user User address
     * @param _numRelays Number of future relays
     * @return projectedScore Score after relays (+10 per relay)
     * @return projectedMaxLoan Max loan at projected score
     */
    function projectCreditGrowth(
        address _user,
        uint256 _numRelays
    )
        external
        view
        returns (uint256 projectedScore, uint256 projectedMaxLoan)
    {
        uint256 currentScore = creditModule.getCreditScore(_user);
        uint256 additionalPoints = _numRelays * 10; // +10 per relay

        projectedScore = currentScore + additionalPoints;
        if (projectedScore > MAX_SCORE) {
            projectedScore = MAX_SCORE;
        }

        // Calculate projected max loan
        if (projectedScore < MIN_BNPL_SCORE) {
            projectedMaxLoan = 0;
        } else {
            uint256 extraScore = projectedScore - MIN_BNPL_SCORE;
            uint256 extraLoan = (extraScore * 1000 ether) / 350;
            projectedMaxLoan = MAX_BNPL_AMOUNT + extraLoan;
        }

        return (projectedScore, projectedMaxLoan);
    }

    /**
     * @notice Batch boost credits for multiple users (gas optimized)
     * @param _users Array of user addresses
     * @param _points Array of points to add
     * @dev Used for bulk processing after multiple relays
     */
    function batchBoostCredit(
        address[] calldata _users,
        uint256[] calldata _points
    ) external nonReentrant onlyAuthorized {
        require(_users.length == _points.length, "Array length mismatch");
        require(_users.length <= 50, "Batch too large");

        for (uint256 i = 0; i < _users.length; i++) {
            require(_users[i] != address(0), "Invalid user");
            require(_points[i] > 0 && _points[i] <= 100, "Invalid points");

            creditModule.increaseCreditScore(_users[i], _points[i]);
            uint256 newScore = creditModule.getCreditScore(_users[i]);

            emit CreditBoosted(_users[i], _points[i], newScore, msg.sender);
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorizes contract to boost credits
     * @param _caller Contract address (e.g., Rewards)
     * @param _authorized Authorization status
     */
    function setAuthorizedCaller(
        address _caller,
        bool _authorized
    ) external onlyOwner {
        require(_caller != address(0), "Invalid caller");
        authorizedCallers[_caller] = _authorized;

        emit CallerAuthorized(_caller, _authorized);
    }

    /**
     * @notice Updates credit module address (owner only)
     * @param _creditModule New credit module address
     */
    function updateCreditModule(address _creditModule) external onlyOwner {
        if (_creditModule == address(0)) revert InvalidCreditModule();

        address oldModule = address(creditModule);
        creditModule = ICreditModule(_creditModule);

        emit CreditModuleUpdated(oldModule, _creditModule);
    }

    /**
     * @notice Checks if address is authorized caller
     * @param _caller Address to check
     * @return bool True if authorized
     */
    function isAuthorizedCaller(address _caller) external view returns (bool) {
        return authorizedCallers[_caller] || _caller == owner();
    }
}
