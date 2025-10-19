// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ICreditModule.sol";

/**
 * @title BNPLLoanManager
 * @notice Buy Now Pay Later loan manager for hardware financing
 * @dev Integrates with Creditcoin credit scoring for loan approvals
 */
contract BNPLLoanManager is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct Loan {
        address borrower;
        uint256 amount;
        uint256 interestRate; // Basis points (e.g., 500 = 5%)
        uint256 duration; // Days
        uint256 startTime;
        uint256 totalPaid;
        uint256 lastPayment;
        bool active;
        address collateralToken;
        uint256 collateralAmount;
    }

    struct LoanTerms {
        uint256 minAmount;
        uint256 maxAmount;
        uint256 minCreditScore;
        uint256 baseInterestRate; // Basis points
        uint256 duration; // Days
        uint256 collateralRatio; // Basis points (e.g., 15000 = 150%)
    }

    // ============ State Variables ============

    /// @notice Credit module for scoring
    ICreditModule public creditModule;

    /// @notice Supported loan token (USDC, etc.)
    address public loanToken;

    /// @notice Loan terms by credit score range
    mapping(uint256 => LoanTerms) public loanTerms;

    /// @notice Active loans by borrower
    mapping(address => Loan) public loans;

    /// @notice Loan counter
    uint256 public loanCount;

    /// @notice Total loans issued
    uint256 public totalLoansIssued;

    /// @notice Total loans repaid
    uint256 public totalLoansRepaid;

    // ============ Events ============

    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint256 interestRate,
        uint256 duration
    );

    event LoanRepayment(
        address indexed borrower,
        uint256 amount,
        uint256 remainingBalance
    );

    event LoanDefaulted(
        address indexed borrower,
        uint256 loanId,
        uint256 outstandingAmount
    );

    event LoanTermsUpdated(uint256 minScore, uint256 maxScore);
    event LoanTokenUpdated(address indexed oldToken, address indexed newToken);

    // ============ Errors ============

    error InsufficientCreditScore();
    error InvalidLoanAmount();
    error ActiveLoanExists();
    error NoActiveLoan();
    error PaymentTooLate();
    error InvalidCollateral();

    // ============ Constructor ============

    constructor(
        address _creditModule,
        address _loanToken
    ) {
        creditModule = ICreditModule(_creditModule);
        loanToken = _loanToken;
        _transferOwnership(msg.sender);

        // Set default loan terms for different credit score ranges
        _setLoanTerms(650, 699, LoanTerms({
            minAmount: 100e6, // $100
            maxAmount: 1000e6, // $1000
            minCreditScore: 650,
            baseInterestRate: 800, // 8%
            duration: 90, // 90 days
            collateralRatio: 15000 // 150%
        }));

        _setLoanTerms(700, 749, LoanTerms({
            minAmount: 500e6, // $500
            maxAmount: 5000e6, // $5000
            minCreditScore: 700,
            baseInterestRate: 600, // 6%
            duration: 180, // 180 days
            collateralRatio: 12000 // 120%
        }));

        _setLoanTerms(750, 850, LoanTerms({
            minAmount: 1000e6, // $1000
            maxAmount: 10000e6, // $10000
            minCreditScore: 750,
            baseInterestRate: 400, // 4%
            duration: 365, // 365 days
            collateralRatio: 10000 // 100%
        }));
    }

    // ============ Core Functions ============

    /**
     * @notice Apply for a BNPL loan
     * @param _amount Loan amount requested
     * @param _collateralToken Collateral token address
     * @param _collateralAmount Collateral amount
     */
    function applyForLoan(
        uint256 _amount,
        address _collateralToken,
        uint256 _collateralAmount
    ) external nonReentrant whenNotPaused {
        require(loans[msg.sender].active == false, "Active loan exists");

        uint256 creditScore = creditModule.getCreditScore(msg.sender);
        LoanTerms memory terms = _getLoanTerms(creditScore);

        require(creditScore >= terms.minCreditScore, "Insufficient credit score");
        require(_amount >= terms.minAmount && _amount <= terms.maxAmount, "Invalid loan amount");

        // Verify collateral ratio
        require(_verifyCollateral(_collateralToken, _collateralAmount, _amount), "Insufficient collateral");

        // Lock collateral
        IERC20(_collateralToken).safeTransferFrom(msg.sender, address(this), _collateralAmount);

        // Create loan
        loanCount++;
        loans[msg.sender] = Loan({
            borrower: msg.sender,
            amount: _amount,
            interestRate: terms.baseInterestRate,
            duration: terms.duration,
            startTime: block.timestamp,
            totalPaid: 0,
            lastPayment: block.timestamp,
            active: true,
            collateralToken: _collateralToken,
            collateralAmount: _collateralAmount
        });

        totalLoansIssued += _amount;

        // Transfer loan amount
        IERC20(loanToken).safeTransfer(msg.sender, _amount);

        emit LoanCreated(loanCount, msg.sender, _amount, terms.baseInterestRate, terms.duration);
    }

    /**
     * @notice Make loan repayment
     * @param _amount Payment amount
     */
    function repayLoan(uint256 _amount) external nonReentrant whenNotPaused {
        Loan storage loan = loans[msg.sender];
        require(loan.active, "No active loan");

        uint256 outstanding = getOutstandingBalance(msg.sender);
        require(_amount <= outstanding, "Overpayment");

        // Transfer payment
        IERC20(loanToken).safeTransferFrom(msg.sender, address(this), _amount);

        loan.totalPaid += _amount;
        loan.lastPayment = block.timestamp;

        // Check if loan is fully repaid
        if (loan.totalPaid >= loan.amount + calculateInterest(loan.amount, loan.interestRate, loan.duration)) {
            loan.active = false;
            totalLoansRepaid += loan.amount;

            // Return collateral
            IERC20(loan.collateralToken).safeTransfer(msg.sender, loan.collateralAmount);
        }

        emit LoanRepayment(msg.sender, _amount, outstanding - _amount);
    }

    /**
     * @notice Check for loan defaults and liquidate if necessary
     * @param _borrower Borrower address
     */
    function checkDefault(address _borrower) external {
        Loan storage loan = loans[_borrower];
        require(loan.active, "No active loan");

        if (_isDefaulted(loan)) {
            loan.active = false;

            // Liquidate collateral (simplified - would use DEX in production)
            uint256 outstanding = getOutstandingBalance(_borrower);
            // In production, this would sell collateral for loan token

            emit LoanDefaulted(_borrower, loanCount, outstanding);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get outstanding balance for borrower
     * @param _borrower Borrower address
     * @return uint256 Outstanding balance
     */
    function getOutstandingBalance(address _borrower) public view returns (uint256) {
        Loan memory loan = loans[_borrower];
        if (!loan.active) return 0;

        uint256 totalOwed = loan.amount + calculateInterest(loan.amount, loan.interestRate, loan.duration);
        return totalOwed - loan.totalPaid;
    }

    /**
     * @notice Get loan details for borrower
     * @param _borrower Borrower address
     * @return Loan struct
     */
    function getLoan(address _borrower) external view returns (Loan memory) {
        return loans[_borrower];
    }

    /**
     * @notice Check if borrower has active loan
     * @param _borrower Borrower address
     * @return bool True if has active loan
     */
    function hasActiveLoan(address _borrower) external view returns (bool) {
        return loans[_borrower].active;
    }

    /**
     * @notice Get loan terms for credit score
     * @param _creditScore Credit score
     * @return LoanTerms struct
     */
    function getLoanTerms(uint256 _creditScore) external view returns (LoanTerms memory) {
        return _getLoanTerms(_creditScore);
    }

    /**
     * @notice Calculate interest for loan
     * @param _principal Principal amount
     * @param _rate Interest rate (basis points)
     * @param _duration Duration in days
     * @return uint256 Interest amount
     */
    function calculateInterest(
        uint256 _principal,
        uint256 _rate,
        uint256 _duration
    ) public pure returns (uint256) {
        // Simple interest: P * r * t
        // r is in basis points, t is in days (assuming 365 days/year)
        return (_principal * _rate * _duration) / (10000 * 365);
    }

    // ============ Internal Functions ============

    /**
     * @notice Get loan terms for credit score
     */
    function _getLoanTerms(uint256 _creditScore) internal view returns (LoanTerms memory) {
        if (_creditScore >= 750) return loanTerms[750];
        if (_creditScore >= 700) return loanTerms[700];
        if (_creditScore >= 650) return loanTerms[650];

        // Default terms for lower scores
        return LoanTerms({
            minAmount: 50e6, // $50
            maxAmount: 500e6, // $500
            minCreditScore: 600,
            baseInterestRate: 1200, // 12%
            duration: 60, // 60 days
            collateralRatio: 20000 // 200%
        });
    }

    /**
     * @notice Set loan terms for credit score range
     */
    function _setLoanTerms(uint256 _minScore, uint256 /* _maxScore */, LoanTerms memory _terms) internal {
        // Store by min score for simplicity
        loanTerms[_minScore] = _terms;
    }

    /**
     * @notice Verify collateral meets requirements
     */
    function _verifyCollateral(
        address /* _collateralToken */,
        uint256 _collateralAmount,
        uint256 _loanAmount
    ) internal pure returns (bool) {
        // Simplified collateral verification
        // In production, this would check collateral value against loan amount
        // using price feeds and required collateral ratio
        return _collateralAmount >= (_loanAmount * 150) / 100; // 150% collateral ratio
    }

    /**
     * @notice Check if loan is defaulted
     */
    function _isDefaulted(Loan memory _loan) internal view returns (bool) {
        uint256 daysSinceLastPayment = (block.timestamp - _loan.lastPayment) / 1 days;
        return daysSinceLastPayment > 30; // 30 day grace period
    }

    // ============ Admin Functions ============

    /**
     * @notice Update loan terms for credit score range
     * @param _minScore Minimum credit score
     * @param _terms Loan terms
     */
    function updateLoanTerms(uint256 _minScore, LoanTerms memory _terms) external onlyOwner {
        loanTerms[_minScore] = _terms;
        emit LoanTermsUpdated(_minScore, _minScore + 49); // Assuming 50-point ranges
    }

    /**
     * @notice Update loan token
     * @param _loanToken New loan token address
     */
    function updateLoanToken(address _loanToken) external onlyOwner {
        require(_loanToken != address(0), "Invalid token");
        emit LoanTokenUpdated(loanToken, _loanToken);
        loanToken = _loanToken;
    }

    /**
     * @notice Update credit module
     * @param _creditModule New credit module address
     */
    function updateCreditModule(address _creditModule) external onlyOwner {
        require(_creditModule != address(0), "Invalid credit module");
        creditModule = ICreditModule(_creditModule);
    }

    /**
     * @notice Emergency withdrawal of funds
     * @param _token Token address
     * @param _amount Amount to withdraw
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
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