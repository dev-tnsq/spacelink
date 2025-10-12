// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICreditModule
 * @notice Interface for Creditcoin's credit scoring system
 * @dev Integrates with Credal BNPL for hardware financing
 */
interface ICreditModule {
    /**
     * @notice Increases credit score for successful relay
     * @param _user Address of node operator
     * @param _points Points to add (+10 per relay)
     */
    function increaseCreditScore(address _user, uint256 _points) external;

    /**
     * @notice Gets current credit score
     * @param _user Address to query
     * @return uint256 Current credit score (0-1000)
     */
    function getCreditScore(address _user) external view returns (uint256);

    /**
     * @notice Checks if user qualifies for BNPL loan
     * @param _user Address to check
     * @param _amount Loan amount requested
     * @return bool True if qualified (score >= 650 for $500)
     */
    function checkLoanEligibility(
        address _user,
        uint256 _amount
    ) external returns (bool);
}
