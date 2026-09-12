// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @dev Minimal ERC-20 surface we need. USDC returns `bool`; some tokens return nothing.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title APIperitivoPayments
/// @notice Pull-payment ledger for APIperitivo service access purchases.
///
/// A client pays `amount` of the payment token (USDC) for access to `serviceId`
/// published by `provider`. The contract keeps the funds and credits the
/// provider, minus an optional platform fee. Providers withdraw with `claim`
/// to any address they like. Every purchase is stored on-chain and emitted as
/// an event so both the app server (to mint the Arkiv access pass) and anyone
/// else can verify exactly what was paid for which service.
///
/// Design notes:
///  - Pull payments only: the contract never pushes tokens to providers.
///  - `provider` is an EVM address (the wallet derived from the provider's
///    Swarm ID, or any wallet they chose at publish time).
///  - `serviceId` is `keccak256(bytes(serviceId))` of the Arkiv service id.
///  - No upgradeability, no pausing: what is deposited can always be claimed.
contract APIperitivoPayments {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    struct Purchase {
        address buyer;
        address provider;
        bytes32 serviceId;
        uint256 amount; // gross, in token units
        uint256 fee; // platform fee taken from `amount`
        uint64 accessSeconds; // informational: duration the provider promised
        uint64 timestamp;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    IERC20 public immutable token;

    address public owner;
    address public feeRecipient;
    uint16 public feeBps;
    uint16 public constant MAX_FEE_BPS = 1_000; // 10%
    uint16 private constant BPS_DENOMINATOR = 10_000;

    /// @dev provider => tokens withdrawable now
    mapping(address => uint256) public claimable;
    /// @dev provider => lifetime net revenue (after fee), including already claimed
    mapping(address => uint256) public totalEarned;
    /// @dev serviceId => lifetime net revenue
    mapping(bytes32 => uint256) public serviceRevenue;
    /// @dev serviceId => number of purchases
    mapping(bytes32 => uint256) public servicePurchases;
    /// @dev fees accrued and not yet withdrawn by the platform
    uint256 public feesAccrued;

    Purchase[] private _purchases;

    uint256 private _lock = 1;

    // ---------------------------------------------------------------------
    // Events & errors
    // ---------------------------------------------------------------------

    event Purchased(
        uint256 indexed purchaseId,
        address indexed buyer,
        address indexed provider,
        bytes32 serviceId,
        uint256 amount,
        uint256 fee,
        uint64 accessSeconds
    );
    event Claimed(address indexed provider, address indexed to, uint256 amount);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event FeeUpdated(uint16 feeBps, address feeRecipient);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance(uint256 requested, uint256 available);
    error FeeTooHigh(uint16 requested, uint16 max);
    error NotOwner();
    error TransferFailed();
    error Reentrancy();

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @param token_ Payment token (USDC on Avalanche Fuji for the demo).
    /// @param owner_ Platform owner allowed to set the fee and withdraw fees.
    /// @param feeBps_ Initial platform fee in basis points (0 = no fee).
    constructor(IERC20 token_, address owner_, uint16 feeBps_) {
        if (address(token_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh(feeBps_, MAX_FEE_BPS);
        token = token_;
        owner = owner_;
        feeRecipient = owner_;
        feeBps = feeBps_;
        emit OwnershipTransferred(address(0), owner_);
        emit FeeUpdated(feeBps_, owner_);
    }

    // ---------------------------------------------------------------------
    // Purchases
    // ---------------------------------------------------------------------

    /// @notice Pay `amount` for access to `serviceId` sold by `provider`.
    /// @dev Caller must have approved this contract for `amount` beforehand.
    /// @return purchaseId Index of the stored purchase (also in the event).
    function buy(address provider, bytes32 serviceId, uint256 amount, uint64 accessSeconds)
        external
        nonReentrant
        returns (uint256 purchaseId)
    {
        if (provider == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 fee = (amount * feeBps) / BPS_DENOMINATOR;
        uint256 net = amount - fee;

        _safeTransferFrom(msg.sender, address(this), amount);

        claimable[provider] += net;
        totalEarned[provider] += net;
        serviceRevenue[serviceId] += net;
        servicePurchases[serviceId] += 1;
        feesAccrued += fee;

        purchaseId = _purchases.length;
        _purchases.push(
            Purchase({
                buyer: msg.sender,
                provider: provider,
                serviceId: serviceId,
                amount: amount,
                fee: fee,
                accessSeconds: accessSeconds,
                timestamp: uint64(block.timestamp)
            })
        );

        emit Purchased(purchaseId, msg.sender, provider, serviceId, amount, fee, accessSeconds);
    }

    // ---------------------------------------------------------------------
    // Claims
    // ---------------------------------------------------------------------

    /// @notice Withdraw earned tokens to `to`. `amount == 0` withdraws everything.
    function claim(address to, uint256 amount) external nonReentrant returns (uint256 withdrawn) {
        if (to == address(0)) revert ZeroAddress();
        uint256 available = claimable[msg.sender];
        withdrawn = amount == 0 ? available : amount;
        if (withdrawn == 0) revert ZeroAmount();
        if (withdrawn > available) revert InsufficientBalance(withdrawn, available);

        claimable[msg.sender] = available - withdrawn;
        _safeTransfer(to, withdrawn);
        emit Claimed(msg.sender, to, withdrawn);
    }

    // ---------------------------------------------------------------------
    // Platform admin
    // ---------------------------------------------------------------------

    function setFee(uint16 feeBps_, address feeRecipient_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh(feeBps_, MAX_FEE_BPS);
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit FeeUpdated(feeBps_, feeRecipient_);
    }

    function withdrawFees() external onlyOwner nonReentrant returns (uint256 amount) {
        amount = feesAccrued;
        if (amount == 0) revert ZeroAmount();
        feesAccrued = 0;
        _safeTransfer(feeRecipient, amount);
        emit FeesWithdrawn(feeRecipient, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function purchaseCount() external view returns (uint256) {
        return _purchases.length;
    }

    function getPurchase(uint256 purchaseId) external view returns (Purchase memory) {
        return _purchases[purchaseId];
    }

    /// @notice Page through purchases, newest first. `offset` counts from the end.
    function getPurchases(uint256 offset, uint256 limit) external view returns (Purchase[] memory page) {
        uint256 total = _purchases.length;
        if (offset >= total || limit == 0) return new Purchase[](0);
        uint256 end = total - offset; // exclusive
        uint256 start = end > limit ? end - limit : 0;
        page = new Purchase[](end - start);
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = _purchases[end - 1 - i];
        }
    }

    /// @notice Helper so front-ends and servers hash service ids the same way.
    function serviceKey(string calldata serviceId) external pure returns (bytes32) {
        return keccak256(bytes(serviceId));
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _safeTransfer(address to, uint256 amount) private {
        (bool ok, bytes memory data) = address(token).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
