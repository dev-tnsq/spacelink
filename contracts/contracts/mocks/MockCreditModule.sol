// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ICreditModule.sol";

/**
 * @title MockCreditModule
 * @notice Mock credit module for MVP testing
 * @dev Production will integrate with Creditcoin's actual Credit Module
 */
contract MockCreditModule is ICreditModule {
    // ============ State Variables ============

    mapping(address => uint256) private creditScores;

    uint256 public constant MAX_SCORE = 1000;
    uint256 public constant MIN_BNPL_SCORE = 650;
    uint256 public constant MAX_BNPL_AMOUNT = 500 ether;

    // ============ Events ============

    event CreditScoreIncreased(
        address indexed user,
        uint256 points,
        uint256 newScore
    );

    event LoanEligibilityChecked(
        address indexed user,
        uint256 amount,
        bool eligible
    );

    // ============ Functions ============

    /**
     * @notice Mock increase credit score
     * @dev Production will update Creditcoin's on-chain credit registry
     */
    function increaseCreditScore(
        address _user,
        uint256 _points
    ) external override {
        require(_user != address(0), "Invalid user");
        require(_points > 0, "Invalid points");

        uint256 currentScore = creditScores[_user];
        uint256 newScore = currentScore + _points;

        if (newScore > MAX_SCORE) {
            newScore = MAX_SCORE;
        }

        creditScores[_user] = newScore;

        emit CreditScoreIncreased(_user, _points, newScore);
    }

    /**
     * @notice Mock get credit score
     */
    function getCreditScore(address _user) external view override returns (uint256) {
        return creditScores[_user];
    }

    /**
     * @notice Mock loan eligibility check
     * @dev Linear scaling: 650 = $500, 1000 = $1500
     */
    function checkLoanEligibility(
        address _user,
        uint256 _amount
    ) external override returns (bool) {
        uint256 score = creditScores[_user];

        bool eligible;
        if (score < MIN_BNPL_SCORE) {
            eligible = false;
        } else {
            // Calculate max loan
            uint256 extraScore = score - MIN_BNPL_SCORE;
            uint256 extraLoan = (extraScore * 1000 ether) / 350;
            uint256 maxLoan = MAX_BNPL_AMOUNT + extraLoan;

            eligible = _amount <= maxLoan;
        }

        emit LoanEligibilityChecked(_user, _amount, eligible);

        return eligible;
    }

    /**
     * @notice Admin function to set initial score (for testing)
     */
    function setInitialScore(address _user, uint256 _score) external {
        require(_score <= MAX_SCORE, "Score too high");
        creditScores[_user] = _score;
    }
}
