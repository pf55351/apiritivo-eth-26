// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {AccessMarket} from "../src/AccessMarket.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function expectRevert(bytes4) external;
    function expectRevert() external;
}
contract TestUSDC is ERC20 {
    constructor() ERC20("Test USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address who, uint256 amount) external { _mint(who, amount); }
}
contract AccessMarketTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    TestUSDC private token;
    AccessMarket private market;
    bytes32 private constant PLAN = keccak256("plan");
    bytes32 private constant SUBJECT = keccak256("subject");
    address private constant BUYER = address(0xB);
    address private constant PROVIDER = address(0xC);
    address private constant TREASURY = address(0xD);
    function setUp() public {
        token = new TestUSDC(); market = new AccessMarket(address(token), address(this));
        market.registerPlan(PLAN, plan(1_000_000, 1000));
        token.mint(BUYER, 10_000_000);
        vm.prank(BUYER); token.approve(address(market), type(uint256).max);
    }
    function plan(uint256 amount, uint16 fee) private pure returns (AccessMarket.Plan memory) {
        return AccessMarket.Plan(keccak256("service"), keccak256("manifest"), PROVIDER, TREASURY, amount, 60, fee, true);
    }
    function testPurchaseSplitAndUniqueId() public {
        vm.prank(BUYER); bytes32 id = market.purchase(PLAN, bytes32(uint256(1)), SUBJECT);
        require(id == keccak256(abi.encode(block.chainid, address(market), BUYER, bytes32(uint256(1)))));
        require(token.balanceOf(PROVIDER) == 900_000 && token.balanceOf(TREASURY) == 100_000);
        require(token.balanceOf(address(market)) == 0 && market.purchased(id));
        vm.expectRevert(AccessMarket.IntentAlreadyUsed.selector);
        vm.prank(BUYER); market.purchase(PLAN, bytes32(uint256(1)), keccak256("other subject"));
        require(token.balanceOf(BUYER) == 9_000_000);
    }
    function testReplayAcrossPlansRejected() public {
        market.registerPlan(keccak256("other"), plan(1, 0));
        vm.prank(BUYER); market.purchase(PLAN, bytes32(uint256(1)), SUBJECT);
        vm.expectRevert(AccessMarket.IntentAlreadyUsed.selector);
        vm.prank(BUYER); market.purchase(keccak256("other"), bytes32(uint256(1)), SUBJECT);
    }
    function testTransferFailureRollsBackBothTransfersAndIntent() public {
        vm.prank(BUYER); token.approve(address(market), 900_000);
        vm.expectRevert(); vm.prank(BUYER); market.purchase(PLAN, bytes32(uint256(1)), SUBJECT);
        require(token.balanceOf(PROVIDER) == 0 && token.balanceOf(TREASURY) == 0);
        vm.prank(BUYER); token.approve(address(market), 1_000_000);
        vm.prank(BUYER); market.purchase(PLAN, bytes32(uint256(1)), SUBJECT);
    }
    function testImmutableAndOnlyOwner() public {
        vm.expectRevert(AccessMarket.PlanAlreadyExists.selector); market.registerPlan(PLAN, plan(2, 0));
        vm.expectRevert(); vm.prank(BUYER); market.setPlanActive(PLAN, false);
        market.setPlanActive(PLAN, false);
        vm.expectRevert(AccessMarket.PlanNotActive.selector);
        vm.prank(BUYER); market.purchase(PLAN, bytes32(uint256(1)), SUBJECT);
    }
    function testRejectBadDurationAndZeroSubject() public {
        AccessMarket.Plan memory p = plan(1, 0); p.durationSeconds = 3;
        vm.expectRevert(AccessMarket.InvalidPlan.selector); market.registerPlan(keccak256("bad"), p);
        vm.expectRevert(AccessMarket.InvalidPurchase.selector);
        vm.prank(BUYER); market.purchase(PLAN, bytes32(uint256(1)), bytes32(0));
    }
    function testFuzzSplitConservesPrice(uint96 amountSeed, uint16 feeSeed) public {
        uint256 amount = uint256(amountSeed) + 1; uint16 fee = feeSeed % 10001;
        market.registerPlan(keccak256("fuzz"), plan(amount, fee)); token.mint(BUYER, amount);
        vm.prank(BUYER); market.purchase(keccak256("fuzz"), bytes32(uint256(2)), SUBJECT);
        require(token.balanceOf(TREASURY) == amount * fee / 10_000);
        require(token.balanceOf(PROVIDER) + token.balanceOf(TREASURY) == amount);
    }
}
