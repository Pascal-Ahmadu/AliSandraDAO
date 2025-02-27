// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AliSandraToken
 * @dev ERC20 token with snapshot functionality for governance.
 */
contract AliSandraToken is ERC20, ERC20Snapshot, Ownable {
   /**
    * @notice Deploys the token and mints the initial supply to the deployer.
    * @param initialSupply The initial supply of tokens.
    */
   constructor(uint256 initialSupply) ERC20("AliSandraToken", "AST") {
        _mint(msg.sender, initialSupply);
   }

   /**
    * @notice Creates a new token balance snapshot.
    * @return The snapshot ID.
    */
   function snapshot() external onlyOwner returns (uint256) {
        return _snapshot();
   }

   /**
    * @dev Overrides the internal _beforeTokenTransfer function to include snapshot support.
    */
   function _beforeTokenTransfer(address from, address to, uint256 amount)
       internal override(ERC20, ERC20Snapshot)
   {
       super._beforeTokenTransfer(from, to, amount);
   }  
}
