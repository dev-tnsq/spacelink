// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IChainlinkOracle
 * @notice Interface for Chainlink oracle verification of relay proofs
 * @dev MVP uses mock implementation; production will use Chainlink DON
 */
interface IChainlinkOracle {
    /**
     * @notice Verifies a relay proof hash against expected parameters
     * @param _proofHash SHA-256 hash of relay data
     * @param _timestamp Expected relay timestamp
     * @param _nodeId Node that performed the relay
     * @param _satId Satellite that was relayed
     * @return bool True if proof is valid
     */
    function verifyProof(
        bytes32 _proofHash,
        uint256 _timestamp,
        uint256 _nodeId,
        uint256 _satId
    ) external returns (bool);

    /**
     * @notice Validates TLE format and freshness
     * @param _tle1 First line of TLE
     * @param _tle2 Second line of TLE
     * @return bool True if TLE is valid
     */
    function validateTLE(
        string memory _tle1,
        string memory _tle2
    ) external view returns (bool);
}
