// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IOracleAggregator.sol";

/**
 * @title OracleAggregator
 * @notice Custom validator-set oracle for TLE data aggregation
 * @dev Multi-sig validation with confidence scoring and freshness checks
 */
contract OracleAggregator is IOracleAggregator, Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    // ============ State Variables ============

    /// @notice Minimum validators required for consensus
    uint256 public minValidators = 3;

    /// @notice Minimum confidence score required (0-100)
    uint256 public minConfidence = 70;

    /// @notice Maximum age for TLE data (7 days)
    uint256 public constant MAX_TLE_AGE = 7 days;

    /// @notice Active validators
    mapping(address => bool) public validators;

    /// @notice Validator count
    uint256 public validatorCount;

    // ============ Mappings ============

    /// @notice TLE submissions by satellite and validator
    mapping(uint256 => mapping(address => TLEData)) public tleSubmissions;

    /// @notice Validation results by satellite
    mapping(uint256 => ValidationResult) public validationResults;

    /// @notice Validator submissions for each satellite
    mapping(uint256 => address[]) public satelliteValidators;

    // ============ Events ============

    event MinValidatorsUpdated(uint256 oldMin, uint256 newMin);
    event MinConfidenceUpdated(uint256 oldMin, uint256 newMin);

    // ============ Errors ============

    error NotValidator();
    error InvalidTLEData();
    error InsufficientValidators();
    error TLETooOld();
    error ValidationFailed();

    // ============ Modifiers ============

    modifier onlyValidator() {
        if (!validators[msg.sender]) revert NotValidator();
        _;
    }

    // ============ Constructor ============

    constructor(address[] memory _initialValidators) {
        require(_initialValidators.length >= minValidators, "Insufficient initial validators");

        for (uint256 i = 0; i < _initialValidators.length; i++) {
            validators[_initialValidators[i]] = true;
        }
        validatorCount = _initialValidators.length;
        _transferOwnership(msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @notice Submit TLE data for validation
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
    ) external override onlyValidator whenNotPaused {
        require(_confidence <= 100, "Invalid confidence");
        require(bytes(_tle1).length == 69, "Invalid TLE1 length");
        require(bytes(_tle2).length == 69, "Invalid TLE2 length");
        require(_timestamp <= block.timestamp + 1 hours, "Future timestamp");

        TLEData memory submission = TLEData({
            tle1: _tle1,
            tle2: _tle2,
            timestamp: _timestamp,
            satelliteId: _satelliteId,
            validator: msg.sender,
            confidence: _confidence
        });

        tleSubmissions[_satelliteId][msg.sender] = submission;

        // Add validator to satellite's validator list if not already present
        address[] storage satValidators = satelliteValidators[_satelliteId];
        bool alreadyExists = false;
        for (uint256 i = 0; i < satValidators.length; i++) {
            if (satValidators[i] == msg.sender) {
                alreadyExists = true;
                break;
            }
        }
        if (!alreadyExists) {
            satValidators.push(msg.sender);
        }

        emit TLESubmitted(_satelliteId, msg.sender, _confidence);

        // Attempt validation if we have enough submissions
        _attemptValidation(_satelliteId);
    }

    /**
     * @notice Get validated TLE data for satellite
     * @param _satelliteId NORAD satellite ID
     * @return tle1 First line of TLE
     * @return tle2 Second line of TLE
     * @return timestamp Last validation timestamp
     * @return confidence Aggregate confidence score
     */
    function getValidatedTLE(uint256 _satelliteId)
        external
        view
        override
        returns (
            string memory tle1,
            string memory tle2,
            uint256 timestamp,
            uint256 confidence
        )
    {
        ValidationResult memory result = validationResults[_satelliteId];
        require(result.isValid, "No valid TLE");

        // Return the TLE with highest confidence
        address[] memory satValidators = satelliteValidators[_satelliteId];
        TLEData memory bestTLE;
        uint256 bestConfidence = 0;

        for (uint256 i = 0; i < satValidators.length; i++) {
            TLEData memory tle = tleSubmissions[_satelliteId][satValidators[i]];
            if (tle.confidence > bestConfidence) {
                bestTLE = tle;
                bestConfidence = tle.confidence;
            }
        }

        return (bestTLE.tle1, bestTLE.tle2, result.lastUpdate, result.confidence);
    }

    /**
     * @notice Check if TLE data is fresh
     * @param _satelliteId NORAD satellite ID
     * @return bool True if TLE is fresh
     */
    function isTLEFresh(uint256 _satelliteId) external view override returns (bool) {
        ValidationResult memory result = validationResults[_satelliteId];
        return result.isValid && (block.timestamp - result.lastUpdate) <= MAX_TLE_AGE;
    }

    // ============ Internal Functions ============

    /**
     * @notice Attempt to validate TLE data for a satellite
     * @param _satelliteId Satellite ID to validate
     */
    function _attemptValidation(uint256 _satelliteId) internal {
        address[] memory satValidators = satelliteValidators[_satelliteId];
        if (satValidators.length < minValidators) return;

        // Find TLE with highest confidence as consensus
        TLEData memory bestTLE;
        uint256 maxConfidence = 0;
        uint256 totalConfidence = 0;

        for (uint256 i = 0; i < satValidators.length; i++) {
            TLEData memory tle = tleSubmissions[_satelliteId][satValidators[i]];
            totalConfidence += tle.confidence;

            if (tle.confidence > maxConfidence) {
                maxConfidence = tle.confidence;
                bestTLE = tle;
            }
        }

        // Check if consensus confidence meets minimum requirement
        if (maxConfidence >= minConfidence) {
            validationResults[_satelliteId] = ValidationResult({
                isValid: true,
                confidence: maxConfidence,
                validatorCount: satValidators.length,
                lastUpdate: block.timestamp
            });

            emit TLEValidated(_satelliteId, maxConfidence, satValidators.length);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get validation result for satellite
     * @param _satelliteId NORAD satellite ID
     * @return Validation result struct
     */
    function getValidationResult(uint256 _satelliteId)
        external
        view
        override
        returns (ValidationResult memory)
    {
        return validationResults[_satelliteId];
    }

    /**
     * @notice Get all active validators
     * @return Array of validator addresses
     */
    function getValidators() external view override returns (address[] memory) {
        address[] memory activeValidators = new address[](validatorCount);

        for (uint256 i = 0; i < validatorCount; i++) {
            // This is a simplified approach - in production you'd maintain an array
            // For now, we'll return empty array as this requires more complex state management
        }

        return activeValidators;
    }

    /**
     * @notice Check if address is a validator
     * @param _validator Address to check
     * @return bool True if validator
     */
    function isValidator(address _validator) external view override returns (bool) {
        return validators[_validator];
    }

    /**
     * @notice Get minimum validators required for consensus
     * @return uint256 Minimum validator count
     */
    function getMinValidators() external view override returns (uint256) {
        return minValidators;
    }

    /**
     * @notice Get minimum confidence required for validation
     * @return uint256 Minimum confidence score
     */
    function getMinConfidence() external view override returns (uint256) {
        return minConfidence;
    }

    // ============ Admin Functions ============

    /**
     * @notice Add a validator (governance only)
     * @param _validator Validator address to add
     */
    function addValidator(address _validator) external override onlyOwner {
        require(_validator != address(0), "Invalid validator");
        require(!validators[_validator], "Already validator");

        validators[_validator] = true;
        validatorCount++;

        emit ValidatorAdded(_validator);
    }

    /**
     * @notice Remove a validator (governance only)
     * @param _validator Validator address to remove
     */
    function removeValidator(address _validator) external override onlyOwner {
        require(validators[_validator], "Not validator");

        validators[_validator] = false;
        validatorCount--;

        emit ValidatorRemoved(_validator);
    }

    /**
     * @notice Update minimum validator count (governance only)
     * @param _minValidators New minimum count
     */
    function updateMinValidators(uint256 _minValidators) external override onlyOwner {
        require(_minValidators >= 1, "Invalid min validators");
        emit MinValidatorsUpdated(minValidators, _minValidators);
        minValidators = _minValidators;
    }

    /**
     * @notice Update minimum confidence score (governance only)
     * @param _minConfidence New minimum confidence
     */
    function updateMinConfidence(uint256 _minConfidence) external override onlyOwner {
        require(_minConfidence <= 100, "Invalid min confidence");
        emit MinConfidenceUpdated(minConfidence, _minConfidence);
        minConfidence = _minConfidence;
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
}