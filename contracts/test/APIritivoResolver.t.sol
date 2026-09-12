// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {APIritivoResolver} from "../src/APIritivoResolver.sol";

contract APIritivoResolverTest is Test {
    APIritivoResolver r;
    address owner = address(0xA11CE);
    address stranger = address(0xB0B);
    bytes32 node = keccak256("apiritivo.eth");

    function setUp() public {
        r = new APIritivoResolver(owner);
    }

    function test_ownerSetsAndAnyoneReads() public {
        vm.startPrank(owner);
        r.setAddr(node, address(0x1234));
        r.setText(node, "com.apiritivo.service", "prova-api-65ee");
        r.setContenthash(node, hex"e40101fa011b20aa");
        vm.stopPrank();
        assertEq(r.addr(node), address(0x1234));
        assertEq(r.addr(node, 60), abi.encodePacked(address(0x1234)));
        assertEq(r.text(node, "com.apiritivo.service"), "prova-api-65ee");
        assertEq(r.contenthash(node), hex"e40101fa011b20aa");
    }

    function test_strangerCannotWrite() public {
        vm.prank(stranger);
        vm.expectRevert(APIritivoResolver.NotOwner.selector);
        r.setText(node, "k", "v");
    }

    function test_multicallBatchesSetters() public {
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeWithSignature("setAddr(bytes32,address)", node, address(0x99));
        calls[1] = abi.encodeWithSignature("setText(bytes32,string,string)", node, "k", "v");
        vm.prank(owner);
        r.multicall(calls);
        assertEq(r.addr(node), address(0x99));
        assertEq(r.text(node, "k"), "v");
    }

    function test_supportsEnsInterfaces() public view {
        assertTrue(r.supportsInterface(0x3b3b57de));
        assertTrue(r.supportsInterface(0x59d1d43c));
        assertTrue(r.supportsInterface(0xbc1c58d1));
        assertTrue(r.supportsInterface(0xf1cb7e06));
        assertTrue(r.supportsInterface(0x9061b923));
    }

    function test_wildcardResolveDispatchesToGetter() public {
        bytes32 sub = keccak256("client.apiritivo.eth");
        vm.prank(owner);
        r.setAddr(sub, address(0x77));
        bytes memory out = r.resolve(hex"06636c69656e740961706972697469766f0365746800", abi.encodeWithSignature("addr(bytes32)", sub));
        assertEq(abi.decode(out, (address)), address(0x77));
        bytes memory t = r.resolve("", abi.encodeWithSignature("text(bytes32,string)", sub, "k"));
        assertEq(abi.decode(t, (string)), "");
    }
}
