/**
 * Chainlink Functions - TLE Validator
 * 
 * This JavaScript runs on Chainlink DON (Decentralized Oracle Network)
 * to validate Two-Line Element (TLE) satellite orbital data
 * 
 * Input args:
 * - tle1: First line of TLE (69 characters)
 * - tle2: Second line of TLE (69 characters)
 * 
 * Returns: 1 if valid, 0 if invalid
 */

// TLE validation functions
function validateTLEChecksum(line) {
  if (line.length !== 69) return false;
  
  let checksum = 0;
  for (let i = 0; i < 68; i++) {
    const char = line[i];
    if (char >= '0' && char <= '9') {
      checksum += parseInt(char);
    } else if (char === '-') {
      checksum += 1;
    }
  }
  
  const expectedChecksum = parseInt(line[68]);
  return (checksum % 10) === expectedChecksum;
}

function validateTLELine1(line) {
  // Line 1: 1 NNNNNC NNNNNAAA NNNNN.NNNNNNNN +.NNNNNNNN +NNNNN-N +NNNNN-N N NNNNN
  if (line.length !== 69) return false;
  if (line[0] !== '1') return false;
  if (line[1] !== ' ') return false;
  
  // Satellite number (columns 3-7)
  const satNum = line.substring(2, 7);
  if (!/^\d{5}$/.test(satNum)) return false;
  
  // Classification (column 8)
  const classification = line[7];
  if (!/[USC]/.test(classification)) return false;
  
  // International designator (columns 10-17)
  const intlDesignator = line.substring(9, 17);
  if (!/^\d{2}\d{3}[A-Z]{3}$/.test(intlDesignator)) return false;
  
  return validateTLEChecksum(line);
}

function validateTLELine2(line) {
  // Line 2: 2 NNNNN NNN.NNNN NNN.NNNN NNNNNNN NNN.NNNN NNN.NNNN NN.NNNNNNNNNNNNNN
  if (line.length !== 69) return false;
  if (line[0] !== '2') return false;
  if (line[1] !== ' ') return false;
  
  // Satellite number (columns 3-7)
  const satNum = line.substring(2, 7);
  if (!/^\d{5}$/.test(satNum)) return false;
  
  return validateTLEChecksum(line);
}

function validateTLEPair(tle1, tle2) {
  // Extract satellite numbers from both lines
  const satNum1 = tle1.substring(2, 7);
  const satNum2 = tle2.substring(2, 7);
  
  // Satellite numbers must match
  if (satNum1 !== satNum2) return false;
  
  return validateTLELine1(tle1) && validateTLELine2(tle2);
}

// Optional: Fetch latest TLE from CelesTrak for comparison
async function fetchLatestTLE(satelliteNumber) {
  try {
    const celestrakRequest = Functions.makeHttpRequest({
      url: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${satelliteNumber}&FORMAT=TLE`,
      timeout: 9000,
      responseType: 'text'
    });
    
    const response = await celestrakRequest;
    
    if (response.error) {
      console.log('CelesTrak fetch error:', response.error);
      return null;
    }
    
    const lines = response.data.trim().split('\n');
    if (lines.length >= 3) {
      return {
        name: lines[0].trim(),
        tle1: lines[1].trim(),
        tle2: lines[2].trim()
      };
    }
    
    return null;
  } catch (error) {
    console.log('CelesTrak fetch exception:', error);
    return null;
  }
}

// Main execution
const tle1 = args[0];
const tle2 = args[1];
const checkCelesTrak = args[2] === 'true'; // Optional: verify against CelesTrak

console.log('Validating TLE...');
console.log('TLE1:', tle1);
console.log('TLE2:', tle2);

// Basic validation
const isValid = validateTLEPair(tle1, tle2);
console.log('Basic validation:', isValid);

if (!isValid) {
  return Functions.encodeUint256(0);
}

// Optional: Check against CelesTrak for freshness
if (checkCelesTrak) {
  const satNum = tle1.substring(2, 7);
  console.log('Fetching latest TLE from CelesTrak for satellite:', satNum);
  
  const latestTLE = await fetchLatestTLE(satNum);
  
  if (latestTLE) {
    console.log('Latest TLE from CelesTrak:', latestTLE.tle1);
    
    // Check if TLE is reasonably recent (epoch within 7 days)
    // This is a simplified check - production would parse epoch properly
    const submittedEpoch = parseFloat(tle1.substring(18, 32));
    const latestEpoch = parseFloat(latestTLE.tle1.substring(18, 32));
    const epochDiff = Math.abs(submittedEpoch - latestEpoch);
    
    console.log('Epoch difference:', epochDiff);
    
    // If epoch differs by more than 7 days (approximately 7.0), reject
    if (epochDiff > 7.0) {
      console.log('TLE too old, rejecting');
      return Functions.encodeUint256(0);
    }
  }
}

// Return 1 if valid
return Functions.encodeUint256(1);
