// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title APIritivoResolver
/// @notice Minimal ENS resolver for the platform name (apiritivo.eth and its subnames).
/// The owner sets `addr`, `text` and `contenthash` records; anyone reads them.
/// Standard ENS profile interfaces so the Universal Resolver, viem and the ENS app resolve it.
contract APIritivoResolver {
    address public owner;

    mapping(bytes32 => mapping(uint256 => bytes)) private _addrs; // node => coinType => address bytes
    mapping(bytes32 => mapping(string => string)) private _texts; // node => key => value
    mapping(bytes32 => bytes) private _contenthashes;

    event AddrChanged(bytes32 indexed node, address a);
    event AddressChanged(bytes32 indexed node, uint256 coinType, bytes newAddress);
    event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value);
    event ContenthashChanged(bytes32 indexed node, bytes hash);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error ZeroAddress();

    uint256 private constant COIN_TYPE_ETH = 60;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
        emit OwnershipTransferred(address(0), owner_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ---- writes (owner) ----

    function setAddr(bytes32 node, address a) external onlyOwner {
        _addrs[node][COIN_TYPE_ETH] = abi.encodePacked(a);
        emit AddrChanged(node, a);
        emit AddressChanged(node, COIN_TYPE_ETH, abi.encodePacked(a));
    }

    function setAddr(bytes32 node, uint256 coinType, bytes calldata a) external onlyOwner {
        _addrs[node][coinType] = a;
        emit AddressChanged(node, coinType, a);
        if (coinType == COIN_TYPE_ETH && a.length == 20) emit AddrChanged(node, address(bytes20(a)));
    }

    function setText(bytes32 node, string calldata key, string calldata value) external onlyOwner {
        _texts[node][key] = value;
        emit TextChanged(node, key, key, value);
    }

    function setContenthash(bytes32 node, bytes calldata hash) external onlyOwner {
        _contenthashes[node] = hash;
        emit ContenthashChanged(node, hash);
    }

    /// @notice Batch several setters in one transaction (owner only, all-or-nothing).
    function multicall(bytes[] calldata data) external onlyOwner returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            (bool ok, bytes memory ret) = address(this).delegatecall(data[i]);
            require(ok, "multicall failed");
            results[i] = ret;
        }
    }

    // ---- reads (ENSIP-1 / ENSIP-9 / ENSIP-5 / ENSIP-7) ----

    function addr(bytes32 node) external view returns (address payable) {
        bytes memory a = _addrs[node][COIN_TYPE_ETH];
        if (a.length != 20) return payable(address(0));
        return payable(address(bytes20(a)));
    }

    function addr(bytes32 node, uint256 coinType) external view returns (bytes memory) {
        return _addrs[node][coinType];
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return _texts[node][key];
    }

    function contenthash(bytes32 node) external view returns (bytes memory) {
        return _contenthashes[node];
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0x3b3b57de // addr(bytes32)
            || interfaceId == 0xf1cb7e06 // addr(bytes32,uint256)
            || interfaceId == 0x59d1d43c // text(bytes32,string)
            || interfaceId == 0xbc1c58d1; // contenthash(bytes32)
    }
}
