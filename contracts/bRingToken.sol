// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BRingToken is ERC20 {

  address constant public INITIAL_SUPPLY_ADDRESS = address(0x0); //TODO: change address

  constructor() ERC20("bRing Token", "BRNG") {
    uint256 initialSupply = 10000000;

    _mint(INITIAL_SUPPLY_ADDRESS, initialSupply * (10 ** uint256(decimals())));
  }

  function batchTransfer(address[] memory addresses, uint256[] memory amounts) external {
    for (uint256 i = 0; i < addresses.length; i++) {
      transfer(addresses[i], amounts[i]);
    }
  }

}
