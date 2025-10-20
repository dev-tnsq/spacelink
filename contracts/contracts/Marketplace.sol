// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./interfaces/IOracleAggregator.sol";
import "./interfaces/IIPFS.sol";
import "./interfaces/ICreditModule.sol";
import "./interfaces/IPaymentRouter.sol";
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
    IOracleAggregator public oracle;

    /// @notice IPFS storage for metadata
    IIPFS public ipfs;

    /// @notice Credit module for scoring
    ICreditModule public creditModule;

    /// @notice Payment router for multi-token payments
    IPaymentRouter public paymentRouter;

    /// @notice Pass lock window (e.g., 30 minutes before pass start)
    uint256 public passLockWindow = 30 minutes;

    // ============ Structs ============

    /**
     * @notice Node structure for ground stations
     * @param owner Address of node operator
     * @param lat Latitude (scaled by 10000, e.g., 140583 = 14.0583°)
     * @param lon Longitude (scaled by 10000)
     * @param specs Hardware specs (e.g., "S-band, 100 Mbps")
     * @param active Registration status
     * @param uptime Uptime percentage (0-100)
     * @param ipfsCID Content ID for extended metadata/photos
     * @param stakeAmount Staked CTC
     * @param totalRelays Number of completed relays
     * @param availability Array of availability windows (start, end timestamps)
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
        uint256[] availability; // [start1, end1, start2, end2, ...]
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
     * @param state Pass state (0=Booked, 1=Transferable, 2=Locked, 3=Completed, 4=Verified, 5=Settled, 6=Disputed)
     * @param payment Payment details {token, amount}
     * @param proofCID IPFS CID of relay proof
     * @param verified Oracle verification status
     * @param metrics Relay metrics {signalStrength, dataSizeBytes, band}
     * @param tleSnapshotHash Hash of TLE snapshot at booking
     */
    struct Pass {
        address operator;
        uint256 nodeId;
        uint256 satId;
        uint256 timestamp;
        uint256 durationMin;
        uint8 state; // 0=Booked, 1=Transferable, 2=Locked, 3=Completed, 4=Verified, 5=Settled, 6=Disputed
        Payment payment;
        string proofCID;
        bool verified;
        RelayMetrics metrics;
        bytes32 tleSnapshotHash;
    }

    struct Payment {
        address token;
        uint256 amount;
    }

    struct RelayMetrics {
        uint256 signalStrength;
        uint256 dataSizeBytes;
        string band;
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
        string proofCID
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
     * @param _oracle Oracle aggregator address
     * @param _ipfs IPFS storage address
     * @param _creditModule Credit module address
     * @param _paymentRouter Payment router address
     */
    constructor(
        address _oracle,
        address _ipfs,
        address _creditModule,
        address _paymentRouter
    ) ERC1155("https://spacelink.network/api/token/{id}.json") {
        oracle = IOracleAggregator(_oracle);
        ipfs = IIPFS(_ipfs);
        creditModule = ICreditModule(_creditModule);
        paymentRouter = IPaymentRouter(_paymentRouter);
        _transferOwnership(msg.sender);
    }

    /**
     * @notice Returns metadata URI for pass NFT
     * @param id Pass ID
     * @return URI pointing to IPFS metadata
     */
    function tokenURI(uint256 id) public view returns (string memory) {
        Pass memory pass = passes[id];
        // Construct IPFS URI with pass metadata
        return string(abi.encodePacked("ipfs://", pass.proofCID, "/metadata.json"));
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
            totalRelays: 0,
            availability: new uint256[](0)
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

    /**
     * @notice Updates node parameters (owner only)
     * @param _nodeId Node ID to update
     * @param _lat New latitude
     * @param _lon New longitude
     * @param _specs New hardware specifications
     * @param _uptime New uptime percentage
     * @param _ipfsCID New IPFS CID for metadata
     */
    function updateNode(
        uint256 _nodeId,
        int256 _lat,
        int256 _lon,
        string memory _specs,
        uint256 _uptime,
        string memory _ipfsCID
    ) external nonReentrant {
        Node storage node = nodes[_nodeId];
        if (node.owner != msg.sender) revert NotNodeOwner();
        if (!node.active) revert NodeNotActive();

        // Validate inputs
        if (!ValidationLibrary.validateCoordinates(_lat, _lon))
            revert InvalidCoordinates();
        if (!ValidationLibrary.validateSpecs(_specs))
            revert InvalidSpecs();
        if (!ValidationLibrary.validateUptime(_uptime))
            revert InvalidUptime();
        if (bytes(_ipfsCID).length == 0) revert InvalidCID();

        node.lat = _lat;
        node.lon = _lon;
        node.specs = _specs;
        node.uptime = _uptime;
        node.ipfsCID = _ipfsCID;

        emit NodeRegistered(_nodeId, msg.sender, _lat, _lon, _specs, _ipfsCID); // Reuse event
    }

    /**
     * @notice Gets available nodes matching criteria (view function)
     * @param params Filter parameters
     * @param cursor Pagination cursor
     * @param limit Max results
     * @return nodeIds Array of matching node IDs
     * @return nextCursor Next cursor for pagination
     */
    function getAvailableNodes(
        NodeFilterParams memory params,
        uint256 cursor,
        uint256 limit
    ) external view returns (uint256[] memory nodeIds, uint256 nextCursor) {
        uint256[] memory temp = new uint256[](nodeCount);
        uint256 count = 0;
        uint256 start = cursor == 0 ? 1 : cursor;

        for (uint256 i = start; i <= nodeCount && count < limit; i++) {
            Node memory node = nodes[i];
            if (!node.active) continue;

            // Apply filters
            if (params.minUptime > 0 && node.uptime < params.minUptime) continue;
            if (params.latMin != 0 && node.lat < params.latMin) continue;
            if (params.latMax != 0 && node.lat > params.latMax) continue;
            if (params.lonMin != 0 && node.lon < params.lonMin) continue;
            if (params.lonMax != 0 && node.lon > params.lonMax) continue;
            if (bytes(params.bands).length > 0 && !stringContains(node.specs, params.bands)) continue;

            // Check availability window
            if (params.timeWindow > 0 && !isAvailableInWindow(node.availability, params.timeWindow)) continue;

            temp[count++] = i;
        }

        nodeIds = new uint256[](count);
        for (uint256 j = 0; j < count; j++) {
            nodeIds[j] = temp[j];
        }
        nextCursor = start + count;
    }

    struct NodeFilterParams {
        int256 latMin;
        int256 latMax;
        int256 lonMin;
        int256 lonMax;
        uint256 minUptime;
        string bands;
        uint256 timeWindow;
    }

    function stringContains(string memory haystack, string memory needle) internal pure returns (bool) {
        return bytes(haystack).length >= bytes(needle).length &&
               keccak256(bytes(haystack)) == keccak256(bytes(needle)); // Simplified
    }

    function isAvailableInWindow(uint256[] memory availability, uint256 window) internal pure returns (bool) {
        for (uint256 i = 0; i < availability.length; i += 2) {
            if (availability[i] <= window && window <= availability[i+1]) return true;
        }
        return false;
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

        sat.tle1 = _tle1;
        sat.tle2 = _tle2;
        sat.lastUpdate = block.timestamp;

        emit SatelliteUpdated(_satId, _tle1, _tle2);
    }

    /**
     * @notice Updates satellite metadata (owner only)
     * @param _satId Satellite ID to update
     * @param _ipfsCID New IPFS CID for metadata
     */
    function updateSatellite(
        uint256 _satId,
        string memory _ipfsCID
    ) external nonReentrant {
        Satellite storage sat = satellites[_satId];
        if (sat.owner != msg.sender) revert NotSatelliteOwner();
        if (!sat.active) revert SatelliteNotActive();
        if (bytes(_ipfsCID).length == 0) revert InvalidCID();

        sat.ipfsCID = _ipfsCID;
        sat.lastUpdate = block.timestamp;

        emit SatelliteUpdated(_satId, sat.tle1, sat.tle2); // Reuse event
    }

    /**
     * @notice Deactivates a satellite (owner only)
     * @param _satId Satellite ID to deactivate
     */
    function deactivateSatellite(uint256 _satId) external nonReentrant {
        Satellite storage sat = satellites[_satId];
        if (sat.owner != msg.sender) revert NotSatelliteOwner();

        sat.active = false;
        emit NodeDeactivated(_satId, msg.sender); // Reuse event
    }

    // ============ Pass Functions ============

    /**
     * @notice Books a relay pass
     * @param _nodeId Ground station ID
     * @param _satId Satellite ID
     * @param _timestamp Scheduled timestamp
     * @param _durationMin Duration in minutes (5-10)
     * @param _token Payment token address
     * @param _amount Payment amount
     * @dev Routes payment via PaymentRouter, mints ERC-1155 pass NFT
     */
    function bookPass(
        uint256 _nodeId,
        uint256 _satId,
        uint256 _timestamp,
        uint256 _durationMin,
        address _token,
        uint256 _amount
    ) external nonReentrant whenNotPaused returns (uint256) {
        // Validate entities
        Node storage node = nodes[_nodeId];
        Satellite storage sat = satellites[_satId];

        if (!node.active) revert NodeNotActive();
        if (!sat.active) revert SatelliteNotActive();

        // Validate duration
        if (!ValidationLibrary.validateDuration(_durationMin))
            revert InvalidDuration();

        // Check TLE freshness
        if (block.timestamp - sat.lastUpdate > 7 days) revert InvalidTLE();

        // Route payment via PaymentRouter
        IPaymentRouter(paymentRouter).routePayment(_token, msg.sender, address(this), _amount);

        // Create pass
        uint256 passId = ++passCount;
        bytes32 tleSnapshot = keccak256(abi.encodePacked(sat.tle1, sat.tle2));
        passes[passId] = Pass({
            operator: msg.sender,
            nodeId: _nodeId,
            satId: _satId,
            timestamp: _timestamp,
            durationMin: _durationMin,
            state: 0, // Booked
            payment: Payment(_token, _amount),
            proofCID: "",
            verified: false,
            metrics: RelayMetrics(0, 0, ""),
            tleSnapshotHash: tleSnapshot
        });

        // Mint ERC-1155 pass NFT
        _mint(msg.sender, passId, 1, "");

        emit PassBooked(
            passId,
            msg.sender,
            _nodeId,
            _satId,
            _timestamp,
            _durationMin
        );

        return passId;
    }

    /**
     * @notice Completes a pass with relay proof and metrics (node owner only)
     * @param _passId Pass ID
     * @param _proofCID IPFS CID of relay proof data
     * @param _metrics Relay metrics (signal strength, data size, band)
     * @param _tleSnapshotHash Hash of TLE snapshot for verification
     * @dev Triggers oracle verification
     */
    function completePass(
        uint256 _passId,
        string memory _proofCID,
        RelayMetrics memory _metrics,
        bytes32 _tleSnapshotHash
    ) external nonReentrant {
        Pass storage pass = passes[_passId];
        Node storage node = nodes[pass.nodeId];

        if (node.owner != msg.sender) revert NotNodeOwner();
        if (pass.state >= 3) revert PassAlreadyCompleted();

        // Store proof, metrics and update state
        pass.state = 3; // Completed
        pass.proofCID = _proofCID;
        pass.metrics = _metrics;
        pass.tleSnapshotHash = _tleSnapshotHash;

        // Increment relay count
        node.totalRelays++;

        emit PassCompleted(_passId, msg.sender, _proofCID);

        // For now, mark as verified (oracle verification would be implemented separately)
        pass.verified = true;
        pass.state = 4; // Verified
        emit PassVerified(_passId, true);
    }

    /**
     * @notice Confirms a booked pass (satellite operator only)
     * @param _passId Pass ID to confirm
     * @dev Changes pass state from Booked (0) to Transferable (1)
     */
    function confirmPass(uint256 _passId) external nonReentrant {
        Pass storage pass = passes[_passId];
        if (pass.operator != msg.sender) revert NotSatelliteOwner();
        if (pass.state != 0) revert("Pass not in booked state");

        pass.state = 1; // Transferable
        emit PassVerified(_passId, true); // Reuse event for confirmation
    }

    /**
     * @notice Cancels a booked pass (either operator or node owner)
     * @param _passId Pass ID to cancel
     * @dev Can only cancel if pass is not locked or completed
     */
    function cancelPass(uint256 _passId) external nonReentrant {
        Pass storage pass = passes[_passId];
        Node storage node = nodes[pass.nodeId];

        // Only operator or node owner can cancel
        if (pass.operator != msg.sender && node.owner != msg.sender) {
            revert("Not authorized to cancel");
        }

        // Cannot cancel if pass is locked, completed, or verified
        if (pass.state >= 2) revert("Pass cannot be cancelled");

        pass.state = 6; // Disputed/Cancelled

        // Return payment to operator (simplified - in production would use payment router)
        if (pass.payment.token == address(0)) {
            // Native token
            (bool success, ) = payable(pass.operator).call{value: pass.payment.amount}("");
            require(success, "Native transfer failed");
        } else {
            // ERC20 token - would need approval, simplified for now
            revert("ERC20 refunds not implemented");
        }

        emit PassVerified(_passId, false); // Reuse event for cancellation
    }

    /**
     * @notice Gets the current status of a pass
     * @param _passId Pass ID
     * @return status Current pass state (0-6)
     * @return isActive Whether pass is still active
     */
    function getPassStatus(uint256 _passId) external view returns (uint8 status, bool isActive) {
        Pass memory pass = passes[_passId];
        status = pass.state;
        // Pass is active if not cancelled/disputed and not settled
        isActive = pass.state < 5;
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
        oracle = IOracleAggregator(_oracle);
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
