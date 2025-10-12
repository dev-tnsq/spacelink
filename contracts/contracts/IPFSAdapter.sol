// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IIPFS.sol";

/**
 * @title IPFSAdapter
 * @notice Production IPFS storage adapter with on-chain CID registry
 * @dev Manages IPFS content identifiers (CIDs) for decentralized file storage
 * 
 * Architecture:
 * - On-chain CID registry with metadata tracking
 * - Off-chain storage via IPFS (Pinata, Infura, or local node)
 * - Storage fee management for sustainability
 * - User upload history tracking
 * 
 * IPFS Integration:
 * - Frontend uploads files to IPFS (via Pinata/Infura HTTP API)
 * - IPFS returns CID (e.g., "QmXxx..." or "bafybei...")
 * - Frontend calls registerCID() to store CID on-chain
 * - Anyone can retrieve files from IPFS gateways
 * 
 * CID Formats Supported:
 * - CIDv0: Base58, starts with "Qm", 46 characters (legacy)
 * - CIDv1: Base32/Base58, starts with "bafy"/"bafk"/"bafy", 59+ chars
 * 
 * Storage Fee Model:
 * - Pay per MB for CID registration
 * - Fees fund pinning services (Pinata, Infura)
 * - Refunds for excess payment
 */
contract IPFSAdapter is IIPFS, Ownable {
    // ============ Constants ============

    uint256 public constant MIN_CID_LENGTH = 46; // CIDv0 minimum
    uint256 public constant MAX_CID_LENGTH = 100; // Reasonable upper bound

    // ============ State Variables ============

    /// @notice IPFS gateway URL for retrieving content
    string public gatewayUrl;

    /// @notice Storage fee per MB in wei
    uint256 public storageFeePerMB;

    /// @notice Accumulated fees for pinning services
    uint256 public accumulatedFees;

    /// @notice Total CIDs registered
    uint256 public totalCIDs;

    /// @notice Mapping of CID to existence
    mapping(string => bool) public cidExists;

    /// @notice Mapping of CID to uploader address
    mapping(string => address) public cidUploader;

    /// @notice Mapping of CID to upload timestamp
    mapping(string => uint256) public cidTimestamp;

    /// @notice Mapping of CID to file size in bytes
    mapping(string => uint256) public cidSize;

    /// @notice Mapping of CID to metadata hash
    mapping(string => bytes32) public cidMetadata;

    /// @notice Mapping of user to their uploaded CIDs
    mapping(address => string[]) public userCIDs;

    // ============ Events ============

    event CIDRegistered(
        string indexed cid,
        address indexed uploader,
        uint256 size,
        bytes32 metadataHash,
        uint256 timestamp
    );

    event CIDRemoved(
        string indexed cid,
        address indexed remover,
        uint256 timestamp
    );

    event GatewayUpdated(
        string oldGateway,
        string newGateway
    );

    event StorageFeeUpdated(
        uint256 oldFee,
        uint256 newFee
    );

    event FeesWithdrawn(
        address indexed recipient,
        uint256 amount
    );

    // ============ Errors ============

    error EmptyData();
    error EmptyCID();
    error InvalidCIDFormat();
    error CIDAlreadyExists();
    error CIDNotFound();
    error InsufficientStorageFee();
    error InvalidSize();
    error InvalidGateway();

    // ============ Constructor ============

    /**
     * @notice Initialize IPFS adapter with default gateway
     */
    constructor() {
        _transferOwnership(msg.sender);
        
        // Default to Pinata gateway
        gatewayUrl = "https://gateway.pinata.cloud/ipfs/";
        
        // Default storage fee: 0.001 CTC per MB
        storageFeePerMB = 0.001 ether;

        emit GatewayUpdated("", gatewayUrl);
        emit StorageFeeUpdated(0, storageFeePerMB);
    }

    // ============ Core Functions ============

    /**
     * @notice Upload data and generate CID (called by frontend after IPFS upload)
     * @dev This is a legacy function for compatibility - just generates a mock CID
     * @param _data Data to hash for CID generation
     * @return string Generated CID
     */
    function upload(bytes memory _data) external payable override returns (string memory) {
        if (_data.length == 0) revert EmptyData();

        // Generate CID from data hash (CIDv0 format: Qm + base58)
        bytes32 dataHash = keccak256(_data);
        string memory cid = _generateCID(dataHash);

        // Calculate required storage fee
        uint256 sizeInMB = (_data.length / 1024 / 1024) + 1; // Round up
        uint256 requiredFee = sizeInMB * storageFeePerMB;

        if (msg.value < requiredFee) revert InsufficientStorageFee();

        // Register CID
        _registerCID(cid, _data.length, keccak256(_data));

        // Refund excess payment
        if (msg.value > requiredFee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - requiredFee}("");
            require(success, "Refund failed");
        }

        accumulatedFees += requiredFee;

        return cid;
    }

    /**
     * @notice Register existing IPFS CID on-chain
     * @dev Frontend uploads to IPFS first, then registers CID here
     * @param _cid IPFS CID (e.g., "QmXxx..." or "bafybeXxx...")
     * @param _size File size in bytes
     * @param _metadataHash Hash of file metadata
     */
    function registerCID(
        string memory _cid,
        uint256 _size,
        bytes32 _metadataHash
    ) external payable override {
        if (bytes(_cid).length == 0) revert EmptyCID();
        if (!_isValidCID(_cid)) revert InvalidCIDFormat();
        if (cidExists[_cid]) revert CIDAlreadyExists();
        if (_size == 0) revert InvalidSize();

        // Calculate required storage fee
        uint256 sizeInMB = (_size / 1024 / 1024) + 1; // Round up
        uint256 requiredFee = sizeInMB * storageFeePerMB;

        if (msg.value < requiredFee) revert InsufficientStorageFee();

        // Register CID
        _registerCID(_cid, _size, _metadataHash);

        // Refund excess payment
        if (msg.value > requiredFee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - requiredFee}("");
            require(success, "Refund failed");
        }

        accumulatedFees += requiredFee;
    }

    /**
     * @notice Download file metadata by CID
     * @dev Actual file retrieval happens off-chain via IPFS gateway
     * @param _cid IPFS CID
     * @return bytes32 Metadata hash
     */
    function download(string memory _cid) external view override returns (bytes32) {
        if (!cidExists[_cid]) revert CIDNotFound();
        return cidMetadata[_cid];
    }

    /**
     * @notice Check if CID exists in registry
     * @param _cid IPFS CID to check
     * @return bool True if exists
     */
    function exists(string memory _cid) external view override returns (bool) {
        return cidExists[_cid];
    }

    /**
     * @notice Get complete CID information
     * @param _cid IPFS CID
     * @return uploader Address that registered the CID
     * @return timestamp When CID was registered
     * @return size File size in bytes
     * @return metadataHash Hash of file metadata
     */
    function getCIDInfo(string memory _cid)
        external
        view
        returns (
            address uploader,
            uint256 timestamp,
            uint256 size,
            bytes32 metadataHash
        )
    {
        if (!cidExists[_cid]) revert CIDNotFound();

        return (
            cidUploader[_cid],
            cidTimestamp[_cid],
            cidSize[_cid],
            cidMetadata[_cid]
        );
    }

    /**
     * @notice Get all CIDs uploaded by a user
     * @param _user User address
     * @return string[] Array of CIDs
     */
    function getUserCIDs(address _user) external view returns (string[] memory) {
        return userCIDs[_user];
    }

    /**
     * @notice Get IPFS gateway URL for a CID
     * @param _cid IPFS CID
     * @return string Full gateway URL
     */
    function getGatewayURL(string memory _cid) external view returns (string memory) {
        return string(abi.encodePacked(gatewayUrl, _cid));
    }

    /**
     * @notice Calculate storage fee for a given file size
     * @param _sizeInBytes File size in bytes
     * @return uint256 Required fee in wei
     */
    function calculateStorageFee(uint256 _sizeInBytes) external view returns (uint256) {
        uint256 sizeInMB = (_sizeInBytes / 1024 / 1024) + 1; // Round up
        return sizeInMB * storageFeePerMB;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update IPFS gateway URL
     * @param _gatewayUrl New gateway URL (e.g., "https://ipfs.io/ipfs/")
     */
    function updateGateway(string memory _gatewayUrl) external onlyOwner {
        if (bytes(_gatewayUrl).length == 0) revert InvalidGateway();
        
        string memory oldGateway = gatewayUrl;
        gatewayUrl = _gatewayUrl;

        emit GatewayUpdated(oldGateway, _gatewayUrl);
    }

    /**
     * @notice Update storage fee per MB
     * @param _feePerMB New fee in wei
     */
    function updateStorageFee(uint256 _feePerMB) external onlyOwner {
        uint256 oldFee = storageFeePerMB;
        storageFeePerMB = _feePerMB;

        emit StorageFeeUpdated(oldFee, _feePerMB);
    }

    /**
     * @notice Remove CID from registry (admin only)
     * @param _cid CID to remove
     */
    function removeCID(string memory _cid) external onlyOwner {
        if (!cidExists[_cid]) revert CIDNotFound();

        cidExists[_cid] = false;
        totalCIDs--;

        emit CIDRemoved(_cid, msg.sender, block.timestamp);
    }

    /**
     * @notice Withdraw accumulated fees
     * @param _recipient Address to receive fees
     * @param _amount Amount to withdraw
     */
    function withdrawFees(address _recipient, uint256 _amount) external onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount <= accumulatedFees, "Insufficient fees");

        accumulatedFees -= _amount;

        (bool success, ) = payable(_recipient).call{value: _amount}("");
        require(success, "Transfer failed");

        emit FeesWithdrawn(_recipient, _amount);
    }

    // ============ Internal Functions ============

    /**
     * @notice Internal function to register CID
     * @param _cid IPFS CID
     * @param _size File size
     * @param _metadataHash Metadata hash
     */
    function _registerCID(
        string memory _cid,
        uint256 _size,
        bytes32 _metadataHash
    ) internal {
        cidExists[_cid] = true;
        cidUploader[_cid] = msg.sender;
        cidTimestamp[_cid] = block.timestamp;
        cidSize[_cid] = _size;
        cidMetadata[_cid] = _metadataHash;

        userCIDs[msg.sender].push(_cid);
        totalCIDs++;

        emit CIDRegistered(_cid, msg.sender, _size, _metadataHash, block.timestamp);
    }

    /**
     * @notice Generate CID from data hash (CIDv0 format)
     * @dev Creates base58-like CID: Qm + 44 chars
     * @param _dataHash Keccak256 hash of data
     * @return string Generated CID
     */
    function _generateCID(bytes32 _dataHash) internal pure returns (string memory) {
        // Simple base58-like encoding for CIDv0
        // In production, frontend uploads to IPFS and gets real CID
        bytes memory alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        bytes memory result = new bytes(46);
        
        result[0] = "Q";
        result[1] = "m";

        uint256 num = uint256(_dataHash);
        for (uint256 i = 45; i >= 2; i--) {
            result[i] = alphabet[num % 58];
            num /= 58;
            if (i == 2) break;
        }

        return string(result);
    }

    /**
     * @notice Validate CID format
     * @dev Checks for CIDv0 (Qm...) or CIDv1 (bafy.../bafk...)
     * @param _cid CID to validate
     * @return bool True if valid
     */
    function _isValidCID(string memory _cid) internal pure returns (bool) {
        bytes memory cidBytes = bytes(_cid);
        uint256 length = cidBytes.length;

        // Check length
        if (length < MIN_CID_LENGTH || length > MAX_CID_LENGTH) {
            return false;
        }

        // Check CIDv0 format: Qm... (46 characters)
        if (length == 46 && cidBytes[0] == "Q" && cidBytes[1] == "m") {
            return true;
        }

        // Check CIDv1 format: bafy.../bafk.../bafyb... (59+ characters)
        if (length >= 59) {
            if (cidBytes[0] == "b" && cidBytes[1] == "a" && cidBytes[2] == "f") {
                if (cidBytes[3] == "y" || cidBytes[3] == "k") {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @notice Fallback to receive CTC
     */
    receive() external payable {
        accumulatedFees += msg.value;
    }
}
