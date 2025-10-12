// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IIPFS
 * @notice Interface for IPFS storage adapter
 * @dev Provides on-chain CID registry for decentralized file storage
 */
interface IIPFS {
    /**
     * @notice Upload data and generate CID
     * @dev Legacy function - frontend should upload to IPFS directly
     * @param _data Data to upload
     * @return string Generated CID
     */
    function upload(bytes memory _data) external payable returns (string memory);

    /**
     * @notice Register existing IPFS CID
     * @param _cid IPFS CID
     * @param _size File size in bytes
     * @param _metadataHash Hash of file metadata
     */
    function registerCID(
        string memory _cid,
        uint256 _size,
        bytes32 _metadataHash
    ) external payable;

    /**
     * @notice Get file metadata by CID
     * @param _cid IPFS CID
     * @return bytes32 Metadata hash
     */
    function download(string memory _cid) external view returns (bytes32);

    /**
     * @notice Check if CID exists
     * @param _cid IPFS CID
     * @return bool True if exists
     */
    function exists(string memory _cid) external view returns (bool);
}
