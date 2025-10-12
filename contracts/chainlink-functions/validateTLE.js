/**
 * Chainlink Functions Source Code - TLE Validation
 * 
 * This JavaScript code runs on Chainlink Decentralized Oracle Network (DON)
 * to validate Two-Line Element (TLE) data for satellites.
 * 
 * TLE Format:
 * Line 1: 69 characters - Satellite identification and orbital elements
 * Line 2: 69 characters - Orbital parameters
 * 
 * Arguments expected:
 * - args[0]: TLE line 1 (string)
 * - args[1]: TLE line 2 (string)
 * - args[2]: Satellite ID to verify (string)
 * 
 * Returns:
 * - 1 if TLE is valid
 * - 0 if TLE is invalid
 */

// TLE validation function
function validateTLEFormat(tle1, tle2) {
  // Check line lengths
  if (tle1.length !== 69 || tle2.length !== 69) {
    console.log("Invalid TLE length");
    return false;
  }

  // Check line numbers (first character)
  if (tle1[0] !== '1' || tle2[0] !== '2') {
    console.log("Invalid TLE line numbers");
    return false;
  }

  // Extract and verify satellite number (positions 3-7)
  const satNum1 = tle1.substring(2, 7).trim();
  const satNum2 = tle2.substring(2, 7).trim();
  
  if (satNum1 !== satNum2) {
    console.log("Satellite numbers don't match");
    return false;
  }

  // Validate checksums
  if (!validateChecksum(tle1) || !validateChecksum(tle2)) {
    console.log("Checksum validation failed");
    return false;
  }

  return true;
}

// TLE checksum validation (modulo 10)
function validateChecksum(line) {
  if (line.length !== 69) return false;

  let sum = 0;
  
  // Sum characters 0-67 (excluding checksum at position 68)
  for (let i = 0; i < 68; i++) {
    const char = line[i];
    
    if (char >= '0' && char <= '9') {
      sum += parseInt(char);
    } else if (char === '-') {
      sum += 1; // Minus signs count as 1
    }
    // All other characters (spaces, letters, +) count as 0
  }

  const checksum = sum % 10;
  const expectedChecksum = parseInt(line[68]);

  return checksum === expectedChecksum;
}

// Validate orbital elements are within reasonable ranges
function validateOrbitalElements(tle1, tle2) {
  try {
    // Extract inclination (line 2, positions 9-16)
    const inclination = parseFloat(tle2.substring(8, 16));
    if (inclination < 0 || inclination > 180) {
      console.log("Invalid inclination:", inclination);
      return false;
    }

    // Extract eccentricity (line 2, positions 27-33, implied decimal point)
    const eccentricityStr = "0." + tle2.substring(26, 33).trim();
    const eccentricity = parseFloat(eccentricityStr);
    if (eccentricity < 0 || eccentricity >= 1) {
      console.log("Invalid eccentricity:", eccentricity);
      return false;
    }

    // Extract mean motion (line 2, positions 53-63) - revolutions per day
    const meanMotion = parseFloat(tle2.substring(52, 63));
    if (meanMotion < 0 || meanMotion > 20) { // Max ~20 rev/day for LEO
      console.log("Invalid mean motion:", meanMotion);
      return false;
    }

    return true;
  } catch (error) {
    console.log("Error parsing orbital elements:", error.message);
    return false;
  }
}

// Optional: Fetch latest TLE from Celestrak and compare
async function verifyTLEFreshness(satId, tle1, tle2) {
  try {
    // Celestrak API endpoint for satellite data
    const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${satId}&FORMAT=TLE`;
    
    const celestrakRequest = Functions.makeHttpRequest({
      url: url,
      timeout: 9000,
      responseType: "text"
    });

    const response = await celestrakRequest;
    
    if (response.error) {
      console.log("Celestrak API error:", response.error);
      return true; // Allow if external API fails
    }

    const celestrakData = response.data;
    const lines = celestrakData.trim().split('\n');

    if (lines.length >= 3) {
      const celestrakTLE1 = lines[1];
      const celestrakTLE2 = lines[2];

      // Extract epoch (line 1, positions 19-32) for freshness check
      const userEpoch = parseFloat(tle1.substring(18, 32));
      const celestrakEpoch = parseFloat(celestrakTLE1.substring(18, 32));

      // Allow TLE if within 7 days of latest
      const epochDiff = Math.abs(userEpoch - celestrakEpoch);
      
      console.log("User epoch:", userEpoch);
      console.log("Celestrak epoch:", celestrakEpoch);
      console.log("Epoch difference:", epochDiff);

      if (epochDiff > 7) {
        console.log("TLE data is stale (>7 days old)");
        return false;
      }
    }

    return true;
  } catch (error) {
    console.log("Error verifying TLE freshness:", error.message);
    return true; // Allow if verification fails
  }
}

// Main execution
(async () => {
  try {
    // Parse arguments
    const tle1 = args[0];
    const tle2 = args[1];
    const satId = args[2] || "";

    console.log("Validating TLE for satellite:", satId);
    console.log("TLE Line 1:", tle1);
    console.log("TLE Line 2:", tle2);

    // Step 1: Validate TLE format
    const formatValid = validateTLEFormat(tle1, tle2);
    if (!formatValid) {
      console.log("TLE format validation failed");
      return Functions.encodeUint256(0);
    }

    // Step 2: Validate orbital elements
    const elementsValid = validateOrbitalElements(tle1, tle2);
    if (!elementsValid) {
      console.log("Orbital elements validation failed");
      return Functions.encodeUint256(0);
    }

    // Step 3: Verify TLE freshness (optional, requires HTTP access)
    if (satId) {
      const freshnessValid = await verifyTLEFreshness(satId, tle1, tle2);
      if (!freshnessValid) {
        console.log("TLE freshness validation failed");
        return Functions.encodeUint256(0);
      }
    }

    console.log("TLE validation successful");
    return Functions.encodeUint256(1);

  } catch (error) {
    console.log("Error during TLE validation:", error.message);
    return Functions.encodeUint256(0);
  }
})();
