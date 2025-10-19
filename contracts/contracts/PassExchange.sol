// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PassExchange
 * @notice Secondary marketplace for trading SpaceLink pass NFTs
 * @dev ERC-1155 marketplace with multi-token support for pass trading
 */
contract PassExchange is Ownable, ReentrancyGuard, Pausable, ERC1155Holder {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct Listing {
        address seller;
        address tokenAddress; // ERC-20 token for payment
        uint256 tokenId;
        uint256 amount;
        uint256 pricePerUnit;
        uint256 totalPrice;
        bool active;
        uint256 createdAt;
    }

    struct Offer {
        address buyer;
        address tokenAddress;
        uint256 tokenId;
        uint256 amount;
        uint256 pricePerUnit;
        uint256 totalPrice;
        uint256 expiresAt;
        bool active;
    }

    // ============ State Variables ============

    /// @notice Marketplace fee (basis points)
    uint256 public marketplaceFee = 250; // 2.5%

    /// @notice Fee recipient
    address public feeRecipient;

    /// @notice SpaceLink marketplace contract
    address public marketplaceContract;

    /// @notice Supported payment tokens
    mapping(address => bool) public supportedTokens;

    // ============ Mappings ============

    /// @notice Listings by listing ID
    mapping(uint256 => Listing) public listings;

    /// @notice Offers by offer ID
    mapping(uint256 => Offer) public offers;

    /// @notice Listing count
    uint256 public listingCount;

    /// @notice Offer count
    uint256 public offerCount;

    /// @notice Listings by seller
    mapping(address => uint256[]) public sellerListings;

    /// @notice Offers by buyer
    mapping(address => uint256[]) public buyerOffers;

    /// @notice Listings by token ID
    mapping(uint256 => uint256[]) public tokenListings;

    // ============ Events ============

    event ListingCreated(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 amount, uint256 price);
    event ListingCancelled(uint256 indexed listingId);
    event ListingSold(uint256 indexed listingId, address indexed buyer, uint256 amount);
    event OfferCreated(uint256 indexed offerId, address indexed buyer, uint256 indexed tokenId, uint256 amount, uint256 price);
    event OfferCancelled(uint256 indexed offerId);
    event OfferAccepted(uint256 indexed offerId, address indexed seller);

    // ============ Errors ============

    error InvalidListing();
    error InvalidOffer();
    error NotAuthorized();
    error InsufficientBalance();
    error ListingNotActive();
    error OfferExpired();
    error UnsupportedToken();

    // ============ Constructor ============

    constructor(address _marketplaceContract, address _feeRecipient) {
        marketplaceContract = _marketplaceContract;
        feeRecipient = _feeRecipient;
        _transferOwnership(msg.sender);
    }

    // ============ Core Functions ============

    /**
     * @notice Create a listing for pass tokens
     * @param _tokenId Pass token ID
     * @param _amount Amount to list
     * @param _tokenAddress Payment token address
     * @param _pricePerUnit Price per unit
     */
    function createListing(
        uint256 _tokenId,
        uint256 _amount,
        address _tokenAddress,
        uint256 _pricePerUnit
    ) external nonReentrant whenNotPaused {
        require(_amount > 0, "Invalid amount");
        require(_pricePerUnit > 0, "Invalid price");
        require(supportedTokens[_tokenAddress], "Unsupported token");

        // Check if user owns the tokens
        require(
            IERC1155(marketplaceContract).balanceOf(msg.sender, _tokenId) >= _amount,
            "Insufficient balance"
        );

        // Transfer tokens to contract
        IERC1155(marketplaceContract).safeTransferFrom(
            msg.sender,
            address(this),
            _tokenId,
            _amount,
            ""
        );

        uint256 listingId = ++listingCount;
        uint256 totalPrice = _amount * _pricePerUnit;

        listings[listingId] = Listing({
            seller: msg.sender,
            tokenAddress: _tokenAddress,
            tokenId: _tokenId,
            amount: _amount,
            pricePerUnit: _pricePerUnit,
            totalPrice: totalPrice,
            active: true,
            createdAt: block.timestamp
        });

        sellerListings[msg.sender].push(listingId);
        tokenListings[_tokenId].push(listingId);

        emit ListingCreated(listingId, msg.sender, _tokenId, _amount, _pricePerUnit);
    }

    /**
     * @notice Buy from a listing
     * @param _listingId Listing ID to buy from
     * @param _amount Amount to buy
     */
    function buyListing(uint256 _listingId, uint256 _amount) external nonReentrant whenNotPaused {
        Listing storage listing = listings[_listingId];
        require(listing.active, "Listing not active");
        require(_amount > 0 && _amount <= listing.amount, "Invalid amount");

        uint256 cost = _amount * listing.pricePerUnit;
        uint256 fee = (cost * marketplaceFee) / 10000;
        uint256 sellerProceeds = cost - fee;

        // Transfer payment token from buyer
        IERC20(listing.tokenAddress).safeTransferFrom(msg.sender, address(this), cost);

        // Transfer fee to recipient
        if (fee > 0) {
            IERC20(listing.tokenAddress).safeTransfer(feeRecipient, fee);
        }

        // Transfer seller proceeds
        IERC20(listing.tokenAddress).safeTransfer(listing.seller, sellerProceeds);

        // Transfer tokens to buyer
        IERC1155(marketplaceContract).safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId,
            _amount,
            ""
        );

        // Update listing
        listing.amount -= _amount;
        if (listing.amount == 0) {
            listing.active = false;
        }

        emit ListingSold(_listingId, msg.sender, _amount);
    }

    /**
     * @notice Cancel a listing
     * @param _listingId Listing ID to cancel
     */
    function cancelListing(uint256 _listingId) external nonReentrant {
        Listing storage listing = listings[_listingId];
        require(listing.seller == msg.sender, "Not seller");
        require(listing.active, "Listing not active");

        listing.active = false;

        // Return tokens to seller
        IERC1155(marketplaceContract).safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId,
            listing.amount,
            ""
        );

        emit ListingCancelled(_listingId);
    }

    /**
     * @notice Create an offer for pass tokens
     * @param _tokenId Pass token ID
     * @param _amount Amount offered
     * @param _tokenAddress Payment token address
     * @param _pricePerUnit Price per unit
     * @param _duration Offer duration in seconds
     */
    function createOffer(
        uint256 _tokenId,
        uint256 _amount,
        address _tokenAddress,
        uint256 _pricePerUnit,
        uint256 _duration
    ) external nonReentrant whenNotPaused {
        require(_amount > 0, "Invalid amount");
        require(_pricePerUnit > 0, "Invalid price");
        require(supportedTokens[_tokenAddress], "Unsupported token");
        require(_duration >= 1 hours && _duration <= 30 days, "Invalid duration");

        uint256 totalPrice = _amount * _pricePerUnit;

        // Transfer tokens to contract for escrow
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), totalPrice);

        uint256 offerId = ++offerCount;

        offers[offerId] = Offer({
            buyer: msg.sender,
            tokenAddress: _tokenAddress,
            tokenId: _tokenId,
            amount: _amount,
            pricePerUnit: _pricePerUnit,
            totalPrice: totalPrice,
            expiresAt: block.timestamp + _duration,
            active: true
        });

        buyerOffers[msg.sender].push(offerId);

        emit OfferCreated(offerId, msg.sender, _tokenId, _amount, _pricePerUnit);
    }

    /**
     * @notice Accept an offer
     * @param _offerId Offer ID to accept
     */
    function acceptOffer(uint256 _offerId) external nonReentrant whenNotPaused {
        Offer storage offer = offers[_offerId];
        require(offer.active, "Offer not active");
        require(block.timestamp <= offer.expiresAt, "Offer expired");

        // Check if seller owns the tokens
        require(
            IERC1155(marketplaceContract).balanceOf(msg.sender, offer.tokenId) >= offer.amount,
            "Insufficient balance"
        );

        uint256 fee = (offer.totalPrice * marketplaceFee) / 10000;
        uint256 sellerProceeds = offer.totalPrice - fee;

        // Transfer tokens from seller to buyer
        IERC1155(marketplaceContract).safeTransferFrom(
            msg.sender,
            offer.buyer,
            offer.tokenId,
            offer.amount,
            ""
        );

        // Transfer fee to recipient
        if (fee > 0) {
            IERC20(offer.tokenAddress).safeTransfer(feeRecipient, fee);
        }

        // Transfer seller proceeds
        IERC20(offer.tokenAddress).safeTransfer(msg.sender, sellerProceeds);

        offer.active = false;

        emit OfferAccepted(_offerId, msg.sender);
    }

    /**
     * @notice Cancel an offer
     * @param _offerId Offer ID to cancel
     */
    function cancelOffer(uint256 _offerId) external nonReentrant {
        Offer storage offer = offers[_offerId];
        require(offer.buyer == msg.sender, "Not buyer");
        require(offer.active, "Offer not active");

        offer.active = false;

        // Refund tokens to buyer
        IERC20(offer.tokenAddress).safeTransfer(msg.sender, offer.totalPrice);

        emit OfferCancelled(_offerId);
    }

    // ============ View Functions ============

    /**
     * @notice Get listing details
     * @param _listingId Listing ID
     * @return Listing struct
     */
    function getListing(uint256 _listingId) external view returns (Listing memory) {
        return listings[_listingId];
    }

    /**
     * @notice Get offer details
     * @param _offerId Offer ID
     * @return Offer struct
     */
    function getOffer(uint256 _offerId) external view returns (Offer memory) {
        return offers[_offerId];
    }

    /**
     * @notice Get listings by seller
     * @param _seller Seller address
     * @return Array of listing IDs
     */
    function getSellerListings(address _seller) external view returns (uint256[] memory) {
        return sellerListings[_seller];
    }

    /**
     * @notice Get offers by buyer
     * @param _buyer Buyer address
     * @return Array of offer IDs
     */
    function getBuyerOffers(address _buyer) external view returns (uint256[] memory) {
        return buyerOffers[_buyer];
    }

    /**
     * @notice Get listings by token ID
     * @param _tokenId Token ID
     * @return Array of listing IDs
     */
    function getTokenListings(uint256 _tokenId) external view returns (uint256[] memory) {
        return tokenListings[_tokenId];
    }

    // ============ Admin Functions ============

    /**
     * @notice Add supported payment token
     * @param _token Token address
     */
    function addSupportedToken(address _token) external onlyOwner {
        supportedTokens[_token] = true;
    }

    /**
     * @notice Remove supported payment token
     * @param _token Token address
     */
    function removeSupportedToken(address _token) external onlyOwner {
        supportedTokens[_token] = false;
    }

    /**
     * @notice Update marketplace fee
     * @param _fee New fee (basis points)
     */
    function updateMarketplaceFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Fee too high"); // Max 10%
        marketplaceFee = _fee;
    }

    /**
     * @notice Update fee recipient
     * @param _recipient New fee recipient
     */
    function updateFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        feeRecipient = _recipient;
    }

    /**
     * @notice Update marketplace contract
     * @param _contract New marketplace contract
     */
    function updateMarketplaceContract(address _contract) external onlyOwner {
        require(_contract != address(0), "Invalid contract");
        marketplaceContract = _contract;
    }

    /**
     * @notice Emergency withdrawal of stuck tokens
     * @param _token Token address
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        if (_token == address(0)) {
            (bool success,) = payable(owner()).call{value: _amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(_token).safeTransfer(owner(), _amount);
        }
    }

    /**
     * @notice Pause contract
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

    // ============ Fallback ============

    receive() external payable {
        // Accept native token
    }
}