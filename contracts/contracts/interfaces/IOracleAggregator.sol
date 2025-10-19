// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOracleAggregator
 * @notice Interface for the custom validator-set oracle aggregator
 * @dev Aggregates TLE data from multiple validator nodes with multi-sig validation
 */
interface IOracleAggregator {
    // ============ Structs ============

    struct TLEData {
        string tle1;                    // First line of TLE
        string tle2;                    // Second line of TLE
        uint256 timestamp;              // Observation timestamp
        uint256 satelliteId;            // NORAD satellite ID
        address validator;              // Validator who submitted
        uint256 confidence;             // Confidence score (0-100)
    }

    struct ValidationResult {
        bool isValid;                  // Whether TLE is validated
        uint256 confidence;             // Aggregate confidence score
        uint256 validatorCount;         // Number of validators
        uint256 lastUpdate;             // Last validation timestamp
    }

    // ============ Events ============

    event TLESubmitted(
        uint256 indexed satelliteId,
        address indexed validator,
        uint256 confidence
    );

    event TLEValidated(
        uint256 indexed satelliteId,
        uint256 confidence,
        uint256 validatorCount
    );

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);

    // ============ Core Functions ============

    /**
     * @notice Submits TLE data for validation
     * @param _satelliteId NORAD satellite ID
     * @param _tle1 First line of TLE
     * @param _tle2 Second line of TLE
     * @param _timestamp Observation timestamp
     * @param _confidence Confidence score (0-100)
     */
    function submitTLE(
        uint256 _satelliteId,
        string calldata _tle1,
        string calldata _tle2,
        uint256 _timestamp,
        uint256 _confidence
    ) external;

    /**
     * @notice Gets validated TLE data for satellite
     * @param _satelliteId NORAD satellite ID
     * @return tle1 First line of TLE
     * @return tle2 Second line of TLE
     * @return timestamp Last validation timestamp
     * @return confidence Aggregate confidence score
     */
    function getValidatedTLE(uint256 _satelliteId)
        external
        view
        returns (
            string memory tle1,
            string memory tle2,
            uint256 timestamp,
            uint256 confidence
        );

    /**
     * @notice Checks if TLE data is fresh (within 7 days)
     * @param _satelliteId NORAD satellite ID
     * @return bool True if TLE is fresh
     */
    function isTLEFresh(uint256 _satelliteId) external view returns (bool);

    // ============ View Functions ============

    /**
     * @notice Gets validation result for satellite
     * @param _satelliteId NORAD satellite ID
     * @return Validation result struct
     */
    function getValidationResult(uint256 _satelliteId)
        external
        view
        returns (ValidationResult memory);

    /**
     * @notice Gets all active validators
     * @return Array of validator addresses
     */
    function getValidators() external view returns (address[] memory);

    /**
     * @notice Checks if address is a validator
     * @param _validator Address to check
     * @return bool True if validator
     */
    function isValidator(address _validator) external view returns (bool);

    /**
     * @notice Gets minimum validators required for consensus
     * @return uint256 Minimum validator count
     */
    function getMinValidators() external view returns (uint256);

    /**
     * @notice Gets minimum confidence required for validation
     * @return uint256 Minimum confidence score
     */
    function getMinConfidence() external view returns (uint256);

    // ============ Admin Functions ============

    /**
     * @notice Adds a validator (governance only)
     * @param _validator Validator address to add
     */
    function addValidator(address _validator) external;

    /**
     * @notice Removes a validator (governance only)
     * @param _validator Validator address to remove
     */
    function removeValidator(address _validator) external;

    /**
     * @notice Updates minimum validator count (governance only)
     * @param _minValidators New minimum count
     */
    function updateMinValidators(uint256 _minValidators) external;

    /**
     * @notice Updates minimum confidence score (governance only)
     * @param _minConfidence New minimum confidence
     */
    function updateMinConfidence(uint256 _minConfidence) external;
}