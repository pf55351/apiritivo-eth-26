// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {APIritivoPayments, IERC20} from "../src/APIritivoPayments.sol";

/// @dev 6-decimal ERC-20 that behaves like USDC (returns bool, reverts on insufficient funds/allowance).
contract MockUSDC is IERC20 {
    string public constant name = "USD Coin";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        require(balanceOf[from] >= amount, "insufficient");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @dev Token that returns `false` instead of reverting (some ERC-20s do).
contract FalseReturningToken is MockUSDC {
    function transfer(address, uint256) public pure override returns (bool) {
        return false;
    }
}

/// @dev Token that returns no data (USDT-style).
contract NoReturnToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    function transfer(address to, uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

/// @dev Malicious token that re-enters `claim` during a transfer.
contract ReentrantToken is MockUSDC {
    APIritivoPayments public target;
    bool private attacking;

    function setTarget(APIritivoPayments t) external {
        target = t;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (!attacking && address(target) != address(0)) {
            attacking = true;
            target.claim(to, 0); // must revert with Reentrancy()
        }
        return super.transfer(to, amount);
    }
}

contract APIritivoPaymentsTest is Test {
    MockUSDC usdc;
    APIritivoPayments payments;

    address owner = makeAddr("owner");
    address provider = makeAddr("provider");
    address buyer = makeAddr("buyer");
    address payout = makeAddr("payout");

    bytes32 constant SERVICE = keccak256("market-data-a81f");
    uint64 constant WEEK = 7 days;
    uint256 constant PRICE = 500_000; // 0.50 USDC

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

    function setUp() public {
        usdc = new MockUSDC();
        payments = new APIritivoPayments(IERC20(address(usdc)), owner, 0);
        usdc.mint(buyer, 1_000_000_000); // 1000 USDC
    }

    function _buy(uint256 amount) internal returns (uint256 id) {
        vm.startPrank(buyer);
        usdc.approve(address(payments), amount);
        id = payments.buy(provider, SERVICE, amount, WEEK);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ constructor

    function test_constructor_setsState() public view {
        assertEq(address(payments.token()), address(usdc));
        assertEq(payments.owner(), owner);
        assertEq(payments.feeRecipient(), owner);
        assertEq(payments.feeBps(), 0);
    }

    function test_constructor_rejectsZeroToken() public {
        vm.expectRevert(APIritivoPayments.ZeroAddress.selector);
        new APIritivoPayments(IERC20(address(0)), owner, 0);
    }

    function test_constructor_rejectsZeroOwner() public {
        vm.expectRevert(APIritivoPayments.ZeroAddress.selector);
        new APIritivoPayments(IERC20(address(usdc)), address(0), 0);
    }

    function test_constructor_rejectsFeeAboveMax() public {
        vm.expectRevert(abi.encodeWithSelector(APIritivoPayments.FeeTooHigh.selector, 1001, 1000));
        new APIritivoPayments(IERC20(address(usdc)), owner, 1001);
    }

    // ------------------------------------------------------------------ buy

    function test_buy_movesTokensAndCreditsProvider() public {
        uint256 id = _buy(PRICE);
        assertEq(id, 0);
        assertEq(usdc.balanceOf(address(payments)), PRICE);
        assertEq(usdc.balanceOf(buyer), 1_000_000_000 - PRICE);
        assertEq(payments.claimable(provider), PRICE);
        assertEq(payments.totalEarned(provider), PRICE);
        assertEq(payments.serviceRevenue(SERVICE), PRICE);
        assertEq(payments.servicePurchases(SERVICE), 1);
        assertEq(payments.purchaseCount(), 1);

        APIritivoPayments.Purchase memory p = payments.getPurchase(0);
        assertEq(p.buyer, buyer);
        assertEq(p.provider, provider);
        assertEq(p.serviceId, SERVICE);
        assertEq(p.amount, PRICE);
        assertEq(p.fee, 0);
        assertEq(p.accessSeconds, WEEK);
        assertEq(p.timestamp, uint64(block.timestamp));
    }

    function test_buy_emitsPurchased() public {
        vm.startPrank(buyer);
        usdc.approve(address(payments), PRICE);
        vm.expectEmit(true, true, true, true, address(payments));
        emit Purchased(0, buyer, provider, SERVICE, PRICE, 0, WEEK);
        payments.buy(provider, SERVICE, PRICE, WEEK);
        vm.stopPrank();
    }

    function test_buy_incrementsIds() public {
        assertEq(_buy(PRICE), 0);
        assertEq(_buy(PRICE), 1);
        assertEq(_buy(PRICE), 2);
        assertEq(payments.claimable(provider), 3 * PRICE);
        assertEq(payments.servicePurchases(SERVICE), 3);
    }

    function test_buy_revertsOnZeroAmount() public {
        vm.prank(buyer);
        vm.expectRevert(APIritivoPayments.ZeroAmount.selector);
        payments.buy(provider, SERVICE, 0, WEEK);
    }

    function test_buy_revertsOnZeroProvider() public {
        vm.prank(buyer);
        vm.expectRevert(APIritivoPayments.ZeroAddress.selector);
        payments.buy(address(0), SERVICE, PRICE, WEEK);
    }

    function test_buy_revertsWithoutApproval() public {
        vm.prank(buyer);
        vm.expectRevert(APIritivoPayments.TransferFailed.selector);
        payments.buy(provider, SERVICE, PRICE, WEEK);
        assertEq(payments.claimable(provider), 0);
        assertEq(payments.purchaseCount(), 0);
    }

    function test_buy_revertsWhenTokenReturnsFalse() public {
        FalseReturningToken bad = new FalseReturningToken();
        APIritivoPayments p2 = new APIritivoPayments(IERC20(address(bad)), owner, 0);
        bad.mint(buyer, PRICE);
        vm.startPrank(buyer);
        bad.approve(address(p2), PRICE);
        p2.buy(provider, SERVICE, PRICE, WEEK); // transferFrom is fine on this mock
        vm.stopPrank();
        vm.prank(provider);
        vm.expectRevert(APIritivoPayments.TransferFailed.selector);
        p2.claim(payout, 0); // transfer returns false -> must revert, balance untouched
        assertEq(p2.claimable(provider), PRICE);
    }

    function test_buy_worksWithNoReturnToken() public {
        NoReturnToken t = new NoReturnToken();
        APIritivoPayments p2 = new APIritivoPayments(IERC20(address(t)), owner, 0);
        t.mint(buyer, PRICE);
        vm.startPrank(buyer);
        t.approve(address(p2), PRICE);
        p2.buy(provider, SERVICE, PRICE, WEEK);
        vm.stopPrank();
        vm.prank(provider);
        p2.claim(payout, 0);
        assertEq(t.balanceOf(payout), PRICE);
    }

    function testFuzz_buy_accounting(uint96 amount, uint16 feeBps) public {
        amount = uint96(bound(amount, 1, 1_000_000_000));
        feeBps = uint16(bound(feeBps, 0, payments.MAX_FEE_BPS()));
        vm.prank(owner);
        payments.setFee(feeBps, owner);

        _buy(amount);
        uint256 fee = (uint256(amount) * feeBps) / 10_000;
        assertEq(payments.claimable(provider), amount - fee);
        assertEq(payments.feesAccrued(), fee);
        assertEq(payments.claimable(provider) + payments.feesAccrued(), amount);
        assertEq(usdc.balanceOf(address(payments)), amount);
    }

    // ------------------------------------------------------------------ claim

    function test_claim_allToAnyAddress() public {
        _buy(PRICE);
        vm.prank(provider);
        vm.expectEmit(true, true, false, true, address(payments));
        emit Claimed(provider, payout, PRICE);
        uint256 got = payments.claim(payout, 0);
        assertEq(got, PRICE);
        assertEq(usdc.balanceOf(payout), PRICE);
        assertEq(payments.claimable(provider), 0);
        assertEq(payments.totalEarned(provider), PRICE, "lifetime revenue must survive claims");
    }

    function test_claim_partial() public {
        _buy(PRICE);
        vm.prank(provider);
        payments.claim(payout, 200_000);
        assertEq(usdc.balanceOf(payout), 200_000);
        assertEq(payments.claimable(provider), 300_000);
    }

    function test_claim_revertsAboveBalance() public {
        _buy(PRICE);
        vm.prank(provider);
        vm.expectRevert(abi.encodeWithSelector(APIritivoPayments.InsufficientBalance.selector, PRICE + 1, PRICE));
        payments.claim(payout, PRICE + 1);
    }

    function test_claim_revertsWhenNothingToClaim() public {
        vm.prank(provider);
        vm.expectRevert(APIritivoPayments.ZeroAmount.selector);
        payments.claim(payout, 0);
    }

    function test_claim_revertsToZeroAddress() public {
        _buy(PRICE);
        vm.prank(provider);
        vm.expectRevert(APIritivoPayments.ZeroAddress.selector);
        payments.claim(address(0), 0);
    }

    function test_claim_otherAccountCannotTakeProviderFunds() public {
        _buy(PRICE);
        vm.prank(buyer);
        vm.expectRevert(APIritivoPayments.ZeroAmount.selector); // buyer has nothing claimable
        payments.claim(buyer, 0);
        assertEq(payments.claimable(provider), PRICE);
    }

    function test_claim_blocksReentrancy() public {
        ReentrantToken evil = new ReentrantToken();
        APIritivoPayments p2 = new APIritivoPayments(IERC20(address(evil)), owner, 0);
        evil.setTarget(p2);
        evil.mint(buyer, PRICE);
        vm.startPrank(buyer);
        evil.approve(address(p2), PRICE);
        p2.buy(provider, SERVICE, PRICE, WEEK);
        vm.stopPrank();

        // The nested claim reverts with Reentrancy(); the outer call bubbles it up as TransferFailed
        // because the token call as a whole failed. Either way: no double withdrawal.
        vm.prank(provider);
        vm.expectRevert(APIritivoPayments.TransferFailed.selector);
        p2.claim(payout, 0);
        assertEq(p2.claimable(provider), PRICE);
    }

    // ------------------------------------------------------------------ fees & admin

    function test_fee_splitAndWithdraw() public {
        vm.prank(owner);
        payments.setFee(250, payout); // 2.5% to `payout`
        _buy(1_000_000); // 1 USDC
        assertEq(payments.claimable(provider), 975_000);
        assertEq(payments.feesAccrued(), 25_000);
        assertEq(payments.serviceRevenue(SERVICE), 975_000);

        vm.prank(owner);
        uint256 got = payments.withdrawFees();
        assertEq(got, 25_000);
        assertEq(usdc.balanceOf(payout), 25_000);
        assertEq(payments.feesAccrued(), 0);
    }

    function test_setFee_onlyOwner() public {
        vm.prank(buyer);
        vm.expectRevert(APIritivoPayments.NotOwner.selector);
        payments.setFee(100, buyer);
    }

    function test_setFee_rejectsAboveMax() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(APIritivoPayments.FeeTooHigh.selector, 1001, 1000));
        payments.setFee(1001, owner);
    }

    function test_withdrawFees_revertsWhenEmpty() public {
        vm.prank(owner);
        vm.expectRevert(APIritivoPayments.ZeroAmount.selector);
        payments.withdrawFees();
    }

    function test_transferOwnership() public {
        vm.prank(owner);
        payments.transferOwnership(payout);
        assertEq(payments.owner(), payout);
        vm.prank(owner);
        vm.expectRevert(APIritivoPayments.NotOwner.selector);
        payments.setFee(1, owner);
    }

    // ------------------------------------------------------------------ views

    function test_getPurchases_pagesNewestFirst() public {
        for (uint256 i = 1; i <= 5; i++) _buy(i * 1000);
        APIritivoPayments.Purchase[] memory page = payments.getPurchases(0, 2);
        assertEq(page.length, 2);
        assertEq(page[0].amount, 5000);
        assertEq(page[1].amount, 4000);
        page = payments.getPurchases(2, 10);
        assertEq(page.length, 3);
        assertEq(page[0].amount, 3000);
        assertEq(page[2].amount, 1000);
        assertEq(payments.getPurchases(5, 10).length, 0);
        assertEq(payments.getPurchases(0, 0).length, 0);
    }

    function test_serviceKey_matchesKeccak() public view {
        assertEq(payments.serviceKey("market-data-a81f"), SERVICE);
    }

    // ------------------------------------------------------------------ invariant-ish

    function test_contractBalanceCoversLiabilities() public {
        vm.prank(owner);
        payments.setFee(100, owner);
        _buy(PRICE);
        _buy(3 * PRICE);
        vm.prank(provider);
        payments.claim(payout, 100_000);
        uint256 liabilities = payments.claimable(provider) + payments.feesAccrued();
        assertEq(usdc.balanceOf(address(payments)), liabilities);
    }
}
