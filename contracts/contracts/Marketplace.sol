// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IChainlinkOracle.sol";
import "./interfaces/IIPFS.sol";
import "./interfaces/ICreditModule.sol";
import "./libraries/ValidationLibrary.sol";

/**
 * @title Marketplace
 * @notice Core SpaceLink marketplace for satellite relay operations
 * @dev Manages nodes, satellites, pass bookings with ERC-1155 for RWAs
 * Gas optimized for ~$0.001/tx on Creditcoin testnet
 */
contract Marketplace is ERC1155, Ownable, ReentrancyGuard, Pausable {
    using ValidationLibrary for *;

    // ============ State Variables ============

    /// @notice Minimum stake required (1 CTC)
    uint256 public constant STAKE_AMOUNT = 1 ether;

    /// @notice Node counter
    uint256 public nodeCount;

    /// @notice Satellite counter
    uint256 public satelliteCount;

    /// @notice Pass counter
    uint256 public passCount;

    /// @notice Oracle for verification
    IChainlinkOracle public oracle;

    /// @notice IPFS storage for metadata
    IIPFS public ipfs;

    /// @notice Credit module for scoring
    ICreditModule public creditModule;

    // ============ Structs ============

    /**
     * @notice Node structure for ground stations
     * @param owner Address of node operator
     * @param lat Latitude (scaled by 10000, e.g., 140583 = 14.0583°)
     * @param lon Longitude (scaled by 10000)
     * @param specs Hardware specs (e.g., "S-band, 100 Mbps")
     * @param active Registration status
     * @param uptime Uptime percentage (0-100)
     * @param walrusCID Content ID for extended metadata/photos
     * @param stakeAmount Staked CTC
     * @param totalRelays Number of completed relays
     */
    struct Node {
        address owner;
        int256 lat;
        int256 lon;
        string specs;
        bool active;
        uint256 uptime;
        string ipfsCID;
        uint256 stakeAmount;
        uint256 totalRelays;
    }

    /**
     * @notice Satellite structure for space assets
     * @param owner Address of satellite operator
     * @param tle1 TLE first line (69 chars)
     * @param tle2 TLE second line (69 chars)
     * @param active Registration status
     * @param lastUpdate Last TLE update timestamp
     * @param walrusCID Content ID for metadata
     */
    struct Satellite {
        address owner;
        string tle1;
        string tle2;
        bool active;
        uint256 lastUpdate;
        string ipfsCID;
    }

    /**
     * @notice Pass structure for relay sessions
     * @param operator Address of satellite operator
     * @param nodeId Ground station ID
     * @param satId Satellite ID
     * @param timestamp Scheduled pass timestamp
     * @param durationMin Duration in minutes (5-10)
     * @param completed Completion status
     * @param proofHash SHA-256 hash of relay data
     * @param verified Oracle verification status
     * @param paymentAmount Payment in CTC/USC
     */
    struct Pass {
        address operator;
        uint256 nodeId;
        uint256 satId;
        uint256 timestamp;
        uint256 durationMin;
        bool completed;
        bytes32 proofHash;
        bool verified;
        uint256 paymentAmount;
    }

    // ============ Mappings ============

    mapping(uint256 => Node) public nodes;
    mapping(uint256 => Satellite) public satellites;
    mapping(uint256 => Pass) public passes;
    mapping(address => uint256[]) public operatorNodes;
    mapping(address => uint256[]) public operatorSatellites;

    // ============ Events ============

    event NodeRegistered(
        uint256 indexed nodeId,
        address indexed owner,
        int256 lat,
        int256 lon,
        string specs,
        string ipfsCID
    );

    event SatelliteRegistered(
        uint256 indexed satId,
        address indexed owner,
        string tle1,
        string tle2,
        string ipfsCID
    );

    event PassBooked(
        uint256 indexed passId,
        address indexed operator,
        uint256 indexed nodeId,
        uint256 satId,
        uint256 timestamp,
        uint256 durationMin
    );

    event PassCompleted(
        uint256 indexed passId,
        address indexed node,
        bytes32 proofHash
    );

    event PassVerified(
        uint256 indexed passId,
        bool verified
    );

    event NodeDeactivated(
        uint256 indexed nodeId,
        address indexed owner
    );

    event SatelliteUpdated(
        uint256 indexed satId,
        string tle1,
        string tle2
    );

    event StakeWithdrawn(
        uint256 indexed nodeId,
        address indexed owner,
        uint256 amount
    );

    event OracleUpdated(
        address indexed oldOracle,
        address indexed newOracle
    );

    event IPFSUpdated(
        address indexed oldIPFS,
        address indexed newIPFS
    );

    event CreditModuleUpdated(
        address indexed oldModule,
        address indexed newModule
    );

    event EmergencyWithdrawal(
        address indexed owner,
        uint256 amount
    );

    // ============ Errors ============

    error InsufficientStake();
    error InvalidCoordinates();
    error InvalidTLE();
    error InvalidDuration();
    error InvalidSpecs();
    error InvalidUptime();
    error NodeNotActive();
    error SatelliteNotActive();
    error NotNodeOwner();
    error NotSatelliteOwner();
    error PassAlreadyCompleted();
    error PassNotCompleted();
    error InsufficientPayment();
    error InvalidCID();
    error OracleVerificationFailed();
    error PassNotVerified();

    // ============ Constructor ============

    /**
     * @notice Initializes marketplace with external contracts
     * @param _oracle Chainlink oracle address
     * @param _ipfs IPFS storage address
     * @param _creditModule Credit module address
     */
    constructor(
        address _oracle,
        address _ipfs,
        address _creditModule
    ) ERC1155("https://spacelink.network/api/token/{id}.json") {
        oracle = IChainlinkOracle(_oracle);
        ipfs = IIPFS(_ipfs);
        creditModule = ICreditModule(_creditModule);
        _transferOwnership(msg.sender);
    }

    // ============ Node Functions ============

    /**
     * @notice Registers a new ground station node
     * @param _lat Latitude (scaled by 10000)
     * @param _lon Longitude (scaled by 10000)
     * @param _specs Hardware specifications
     * @param _uptime Expected uptime percentage
     * @param _ipfsCID IPFS CID for station photos/metadata
     * @dev Requires 1 CTC stake, validates coords
     */
    function registerNode(
        int256 _lat,
        int256 _lon,
        string memory _specs,
        uint256 _uptime,
        string memory _ipfsCID
    ) external payable nonReentrant whenNotPaused {
        // Validate stake
        if (msg.value < STAKE_AMOUNT) revert InsufficientStake();

        // Validate inputs
        if (!ValidationLibrary.validateCoordinates(_lat, _lon))
            revert InvalidCoordinates();
        if (!ValidationLibrary.validateSpecs(_specs))
            revert InvalidSpecs();
        if (!ValidationLibrary.validateUptime(_uptime))
            revert InvalidUptime();
        if (bytes(_ipfsCID).length == 0) revert InvalidCID();

        // Create node
        uint256 nodeId = ++nodeCount;
        nodes[nodeId] = Node({
            owner: msg.sender,
            lat: _lat,
            lon: _lon,
            specs: _specs,
            active: true,
            uptime: _uptime,
            ipfsCID: _ipfsCID,
            stakeAmount: msg.value,
            totalRelays: 0
        });

        operatorNodes[msg.sender].push(nodeId);

        emit NodeRegistered(nodeId, msg.sender, _lat, _lon, _specs, _ipfsCID);
    }

    /**
     * @notice Deactivates a node (owner only)
     * @param _nodeId Node ID to deactivate
     */
    function deactivateNode(uint256 _nodeId) external nonReentrant {
        Node storage node = nodes[_nodeId];
        if (node.owner != msg.sender) revert NotNodeOwner();

        node.active = false;
        emit NodeDeactivated(_nodeId, msg.sender);
    }

    /**
     * @notice Withdraws stake after deactivation (owner only)
     * @param _nodeId Node ID
     */
    function withdrawStake(uint256 _nodeId) external nonReentrant {
        Node storage node = nodes[_nodeId];
        if (node.owner != msg.sender) revert NotNodeOwner();
        if (node.active) revert NodeNotActive();

        uint256 amount = node.stakeAmount;
        node.stakeAmount = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit StakeWithdrawn(_nodeId, msg.sender, amount);
    }

    // ============ Satellite Functions ============

    /**
     * @notice Registers a new satellite
     * @param _tle1 TLE first line (69 chars)
     * @param _tle2 TLE second line (69 chars)
     * @param _ipfsCID IPFS CID for satellite metadata
     * @dev Requires 1 CTC stake, validates TLE
     */
    function registerSatellite(
        string memory _tle1,
        string memory _tle2,
        string memory _ipfsCID
    ) external payable nonReentrant whenNotPaused {
        // Validate stake
        if (msg.value < STAKE_AMOUNT) revert InsufficientStake();

        // Validate TLE
        if (!ValidationLibrary.validateTLE(_tle1, _tle2))
            revert InvalidTLE();

        // Verify TLE with oracle
        if (!oracle.validateTLE(_tle1, _tle2))
            revert InvalidTLE();
        
        if (bytes(_ipfsCID).length == 0) revert InvalidCID();

        // Create satellite
        uint256 satId = ++satelliteCount;
        satellites[satId] = Satellite({
            owner: msg.sender,
            tle1: _tle1,
            tle2: _tle2,
            active: true,
            lastUpdate: block.timestamp,
            ipfsCID: _ipfsCID
        });

        operatorSatellites[msg.sender].push(satId);

        emit SatelliteRegistered(satId, msg.sender, _tle1, _tle2, _ipfsCID);
    }

    /**
     * @notice Updates satellite TLE (owner only, weekly recommended)
     * @param _satId Satellite ID
     * @param _tle1 New TLE first line
     * @param _tle2 New TLE second line
     */
    function updateSatelliteTLE(
        uint256 _satId,
        string memory _tle1,
        string memory _tle2
    ) external nonReentrant {
        Satellite storage sat = satellites[_satId];
        if (sat.owner != msg.sender) revert NotSatelliteOwner();

        // Validate TLE
        if (!ValidationLibrary.validateTLE(_tle1, _tle2))
            revert InvalidTLE();
        if (!oracle.validateTLE(_tle1, _tle2))
            revert InvalidTLE();

        sat.tle1 = _tle1;
        sat.tle2 = _tle2;
        sat.lastUpdate = block.timestamp;

        emit SatelliteUpdated(_satId, _tle1, _tle2);
    }

    // ============ Pass Functions ============

    /**
     * @notice Books a satellite pass relay session
     * @param _nodeId Ground station ID
     * @param _satId Satellite ID
     * @param _durationMin Duration in minutes (5-10)
     * @dev Requires 1 CTC payment (USC for Spacecoin), mints ERC-1155 RWA
     * Note: SGP4 prediction done off-chain via Cloud Run, LOS confirmed in UI
     */
    function bookPass(
        uint256 _nodeId,
        uint256 _satId,
        uint256 _durationMin
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        // Validate entities
        Node storage node = nodes[_nodeId];
        Satellite storage sat = satellites[_satId];

        if (!node.active) revert NodeNotActive();
        if (!sat.active) revert SatelliteNotActive();

        // Validate duration
        if (!ValidationLibrary.validateDuration(_durationMin))
            revert InvalidDuration();

        // Validate payment
        if (msg.value < STAKE_AMOUNT) revert InsufficientPayment();

        // Create pass
        uint256 passId = ++passCount;
        passes[passId] = Pass({
            operator: msg.sender,
            nodeId: _nodeId,
            satId: _satId,
            timestamp: block.timestamp + 600, // 10 min briefing period
            durationMin: _durationMin,
            completed: false,
            proofHash: bytes32(0),
            verified: false,
            paymentAmount: msg.value
        });

        // Mint ERC-1155 RWA token
        _mint(msg.sender, passId, 1, "");

        emit PassBooked(
            passId,
            msg.sender,
            _nodeId,
            _satId,
            passes[passId].timestamp,
            _durationMin
        );

        return passId;
    }

    /**
     * @notice Completes a pass with relay proof (node owner only)
     * @param _passId Pass ID
     * @param _proofHash SHA-256 hash of relay data (12 GB at 100 Mbps)
     * @dev Triggers Chainlink oracle verification
     */
    function completePass(
        uint256 _passId,
        bytes32 _proofHash
    ) external nonReentrant {
        Pass storage pass = passes[_passId];
        Node storage node = nodes[pass.nodeId];

        if (node.owner != msg.sender) revert NotNodeOwner();
        if (pass.completed) revert PassAlreadyCompleted();

        // Store proof
        pass.completed = true;
        pass.proofHash = _proofHash;

        // Increment relay count
        node.totalRelays++;

        emit PassCompleted(_passId, msg.sender, _proofHash);

        // Trigger oracle verification (callback pattern)
        bool verified = oracle.verifyProof(
            _proofHash,
            pass.timestamp,
            pass.nodeId,
            pass.satId
        );

        pass.verified = verified;
        emit PassVerified(_passId, verified);
    }

    // ============ View Functions ============

    /**
     * @notice Gets node details
     * @param _nodeId Node ID
     * @return Node struct
     */
    function getNode(uint256 _nodeId) external view returns (Node memory) {
        return nodes[_nodeId];
    }

    /**
     * @notice Gets satellite details
     * @param _satId Satellite ID
     * @return Satellite struct
     */
    function getSatellite(uint256 _satId) external view returns (Satellite memory) {
        return satellites[_satId];
    }

    /**
     * @notice Gets pass details
     * @param _passId Pass ID
     * @return Pass struct
     */
    function getPass(uint256 _passId) external view returns (Pass memory) {
        return passes[_passId];
    }

    /**
     * @notice Gets all nodes owned by an operator
     * @param _operator Operator address
     * @return uint256[] Array of node IDs
     */
    function getOperatorNodes(address _operator) external view returns (uint256[] memory) {
        return operatorNodes[_operator];
    }

    /**
     * @notice Gets all satellites owned by an operator
     * @param _operator Operator address
     * @return uint256[] Array of satellite IDs
     */
    function getOperatorSatellites(address _operator) external view returns (uint256[] memory) {
        return operatorSatellites[_operator];
    }

    // ============ Admin Functions ============

    /**
     * @notice Updates oracle address (owner only)
     * @param _oracle New oracle address
     */
    function updateOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle address");
        emit OracleUpdated(address(oracle), _oracle);
        oracle = IChainlinkOracle(_oracle);
    }

    /**
     * @notice Updates IPFS address (owner only)
     * @param _ipfs New IPFS address
     */
    function updateIPFS(address _ipfs) external onlyOwner {
        require(_ipfs != address(0), "Invalid IPFS address");
        emit IPFSUpdated(address(ipfs), _ipfs);
        ipfs = IIPFS(_ipfs);
    }

    /**
     * @notice Updates credit module address (owner only)
     * @param _creditModule New credit module address
     */
    function updateCreditModule(address _creditModule) external onlyOwner {
        require(_creditModule != address(0), "Invalid credit module address");
        emit CreditModuleUpdated(address(creditModule), _creditModule);
        creditModule = ICreditModule(_creditModule);
    }

    /**
     * @notice Emergency withdrawal (only owner, when paused)
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner whenPaused {
        require(_amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = payable(owner()).call{value: _amount}("");
        require(success, "Transfer failed");
        emit EmergencyWithdrawal(owner(), _amount);
    }

    /**
     * @notice Pauses contract (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Receives CTC payments
     */
    receive() external payable {}
}
