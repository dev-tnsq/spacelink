// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@gluwa/creditcoin-public-prover/sol/Types.sol";

interface ICreditcoinPublicProver {
    function getQueryDetails(bytes32 queryId) external view returns (QueryDetails memory);
    function computeQueryCost(ChainQuery calldata query) external view returns (uint256);
    function submitQuery(ChainQuery calldata query, address principal) external payable;
}