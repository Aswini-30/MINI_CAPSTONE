// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract CarbonProjectNFT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 private _nextTokenId = 1;

    event ProjectNFTMinted(address indexed to, uint256 tokenId);

    constructor() ERC721("Carbon Project NFT", "CPN") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mintProjectNFT(address to) public onlyRole(MINTER_ROLE) returns(uint256) {
        require(to != address(0), "CarbonProjectNFT: mint to zero address");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(to, tokenId);

        emit ProjectNFTMinted(to, tokenId);

        return tokenId;
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}