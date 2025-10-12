// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IChainlinkOracle.sol";

/**
 * @title MockChainlinkOracle
 * @notice Mock oracle for MVP testing
 * @dev Production will use Chainlink DON for 1M+ passes
 */
contract MockChainlinkOracle is IChainlinkOracle {
    // ============ State Variables ============

    mapping(bytes32 => bool) public verifiedProofs;
    mapping(bytes32 => bool) public validTLEs;

    // ============ Events ============

    event ProofVerified(
        bytes32 indexed proofHash,
        uint256 timestamp,
        uint256 nodeId,
        uint256 satId,
        bool result
    );

    event TLEValidated(
        string tle1,
        string tle2,
        bool result
    );

    // ============ Functions ============

    /**
     * @notice Mock verification - always returns true for MVP
     * @dev Production will validate against Walrus data and TLE predictions
     */
    function verifyProof(
        bytes32 _proofHash,
        uint256 _timestamp,
        uint256 _nodeId,
        uint256 _satId
    ) external override returns (bool) {
        // Simple validation: check if timestamp is reasonable
        bool isValid = _timestamp > 0 &&
                       _timestamp <= block.timestamp + 3600 && // Within 1 hour
                       _proofHash != bytes32(0);

        verifiedProofs[_proofHash] = isValid;

        emit ProofVerified(_proofHash, _timestamp, _nodeId, _satId, isValid);

        return isValid;
    }

    /**
     * @notice Mock TLE validation
     * @dev Production will check epoch, checksum, and orbital parameters
     */
    function validateTLE(
        string memory _tle1,
        string memory _tle2
    ) external view override returns (bool) {
        bytes memory tle1Bytes = bytes(_tle1);
        bytes memory tle2Bytes = bytes(_tle2);

        // Basic format check
        if (tle1Bytes.length != 69 || tle2Bytes.length != 69) return false;
        if (tle1Bytes[0] != 0x31 || tle2Bytes[0] != 0x32) return false;

        return true;
    }

    /**
     * @notice Admin function to set proof verification result
     * @dev For testing different scenarios
     */
    function setProofVerification(bytes32 _proofHash, bool _result) external {
        verifiedProofs[_proofHash] = _result;
    }
}
