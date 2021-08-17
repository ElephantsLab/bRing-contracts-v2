// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BRingFarmingOwnable.sol";

contract BRingFarming is BRingFarmingOwnable {

  address[] public poolAddresses;
  mapping(address => Pool) pools;

  mapping(address => User) public users;
  mapping(address => Stake[]) public stakes;

  function stake(address referrer, address stakedTokenAddress, uint256 amount) external whenNotPaused {
    //TODO: implement
  }

  function unstake(address userAddress, uint256 stakeIdx) external whenNotPaused {
    //TODO: implement
  }

}
