// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Settles fixed-price, time-based API purchases. Arkiv activation is asynchronous.
/// @dev Deploy only with the configured, non-rebasing, non-fee-on-transfer USDC token.
contract AccessMarket is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    struct Plan {
        bytes32 serviceId;
        bytes32 manifestRef;
        address provider;
        address treasury;
        uint256 priceAtomic;
        uint32 durationSeconds;
        uint16 feeBps;
        bool active;
    }
    IERC20 public immutable paymentToken;
    mapping(bytes32 => Plan) private _plans;
    mapping(bytes32 => bool) public purchased;
    error InvalidPlan();
    error PlanAlreadyExists();
    error PlanNotActive();
    error InvalidPurchase();
    error IntentAlreadyUsed();
    event PlanRegistered(bytes32 indexed planId, bytes32 indexed serviceId, bytes32 manifestRef);
    event PlanActivityChanged(bytes32 indexed planId, bool active);
    event AccessPurchased(
        bytes32 indexed purchaseId, bytes32 indexed planId, address indexed payer,
        bytes32 purchaseIntentId, bytes32 subject, uint256 amount,
        uint256 providerAmount, uint256 feeAmount
    );

    constructor(address token, address operator) Ownable(operator) {
        if (token == address(0) || token.code.length == 0) revert InvalidPlan();
        paymentToken = IERC20(token);
    }

    function registerPlan(bytes32 planId, Plan calldata plan) external onlyOwner {
        if (_plans[planId].provider != address(0)) revert PlanAlreadyExists();
        if (
            planId == bytes32(0) || plan.serviceId == bytes32(0) || plan.manifestRef == bytes32(0) ||
            plan.provider == address(0) || plan.treasury == address(0) || plan.priceAtomic == 0 ||
            plan.durationSeconds < 2 || plan.durationSeconds > 30 days || plan.durationSeconds % 2 != 0 ||
            plan.feeBps > 10_000
        ) revert InvalidPlan();
        _plans[planId] = plan;
        emit PlanRegistered(planId, plan.serviceId, plan.manifestRef);
    }

    function getPlan(bytes32 planId) external view returns (Plan memory) { return _plans[planId]; }

    function setPlanActive(bytes32 planId, bool active) external onlyOwner {
        if (_plans[planId].provider == address(0)) revert InvalidPlan();
        _plans[planId].active = active;
        emit PlanActivityChanged(planId, active);
    }

    function purchase(bytes32 planId, bytes32 purchaseIntentId, bytes32 subject)
        external nonReentrant returns (bytes32 id)
    {
        Plan memory plan = _plans[planId];
        if (!plan.active || plan.provider == address(0)) revert PlanNotActive();
        if (purchaseIntentId == bytes32(0) || subject == bytes32(0)) revert InvalidPurchase();
        id = keccak256(abi.encode(block.chainid, address(this), msg.sender, purchaseIntentId));
        if (purchased[id]) revert IntentAlreadyUsed();
        purchased[id] = true;
        // Split without overflowing even for large token amounts; fee rounds down.
        uint256 fee = (plan.priceAtomic / 10_000) * plan.feeBps
            + ((plan.priceAtomic % 10_000) * plan.feeBps) / 10_000;
        uint256 providerAmount = plan.priceAtomic - fee;
        if (providerAmount != 0) paymentToken.safeTransferFrom(msg.sender, plan.provider, providerAmount);
        if (fee != 0) paymentToken.safeTransferFrom(msg.sender, plan.treasury, fee);
        emit AccessPurchased(id, planId, msg.sender, purchaseIntentId, subject, plan.priceAtomic, providerAmount, fee);
    }
}
