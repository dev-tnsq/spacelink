// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ValidationLibrary
 * @notice Helper library for input validation
 * @dev Gas-optimized validation functions
 */
library ValidationLibrary {
    /**
     * @notice Validates geographic coordinates
     * @param _lat Latitude as integer (e.g., 140583 = 14.0583°)
     * @param _lon Longitude as integer
     * @return bool True if valid
     */
    function validateCoordinates(
        int256 _lat,
        int256 _lon
    ) internal pure returns (bool) {
        // Lat range: -90° to +90° (scaled by 10000)
        if (_lat < -900000 || _lat > 900000) return false;
        // Lon range: -180° to +180° (scaled by 10000)
        if (_lon < -1800000 || _lon > 1800000) return false;
        return true;
    }

    /**
     * @notice Validates TLE format (Two-Line Element)
     * @param _tle1 First line (69 characters)
     * @param _tle2 Second line (69 characters)
     * @return bool True if valid format
     */
    function validateTLE(
        string memory _tle1,
        string memory _tle2
    ) internal pure returns (bool) {
        bytes memory tle1Bytes = bytes(_tle1);
        bytes memory tle2Bytes = bytes(_tle2);

        // TLE lines must be exactly 69 characters
        if (tle1Bytes.length != 69 || tle2Bytes.length != 69) return false;

        // Line 1 must start with '1'
        if (tle1Bytes[0] != 0x31) return false;

        // Line 2 must start with '2'
        if (tle2Bytes[0] != 0x32) return false;

        return true;
    }

    /**
     * @notice Validates relay duration
     * @param _durationMin Duration in minutes
     * @return bool True if valid (5-10 minutes)
     */
    function validateDuration(
        uint256 _durationMin
    ) internal pure returns (bool) {
        return _durationMin >= 5 && _durationMin <= 10;
    }

    /**
     * @notice Validates node specifications string
     * @param _specs Specs string (e.g., "S-band, 100 Mbps")
     * @return bool True if not empty
     */
    function validateSpecs(string memory _specs) internal pure returns (bool) {
        return bytes(_specs).length > 0 && bytes(_specs).length <= 256;
    }

    /**
     * @notice Validates uptime percentage
     * @param _uptime Uptime as percentage (0-100)
     * @return bool True if valid
     */
    function validateUptime(uint256 _uptime) internal pure returns (bool) {
        return _uptime <= 100;
    }
}
