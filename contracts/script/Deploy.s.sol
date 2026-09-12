// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {APIperitivoPayments, IERC20} from "../src/APIperitivoPayments.sol";

/// @notice Deploy script. NOT run yet. When ready:
///   cd contracts
///   AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc \
///   USDC_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65 \
///   FEE_BPS=0 DEPLOYER_PRIVATE_KEY=0x... \
///   forge script script/Deploy.s.sol:Deploy --rpc-url fuji --broadcast
/// Then put the printed address in NEXT_PUBLIC_PAYMENTS_CONTRACT_ADDRESS.
contract Deploy is Script {
    function run() external returns (APIperitivoPayments payments) {
        address usdc = vm.envAddress("USDC_ADDRESS");
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(0)));
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envOr("OWNER", vm.addr(pk));

        vm.startBroadcast(pk);
        payments = new APIperitivoPayments(IERC20(usdc), owner, feeBps);
        vm.stopBroadcast();

        console.log("APIperitivoPayments deployed at", address(payments));
        console.log("token", usdc, "owner", owner);
        console.log("feeBps", feeBps);
    }
}
