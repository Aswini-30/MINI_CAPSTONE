// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract CarbonCreditToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    constructor() ERC20("Carbon Credit Token", "CCT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }
    
    function mintCredits(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(to != address(0), "CarbonCreditToken: mint to zero address");
        _mint(to, amount);
    }
    
    function burnCredits(address from, uint256 amount) public onlyRole(MINTER_ROLE) {
        _burn(from, amount);
    }
}

