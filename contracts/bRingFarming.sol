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
    User storage user = users[msg.sender];
    Pool storage pool = pools[stakedTokenAddress];

    // Update user data
    if (user.referrer == address(0x0) && referrer != address(0x0)) {
      user.referrer = referrer;
    }

    // Create stake
    Stake memory _stake;
    _stake.idx = stakes[msg.sender].length;
    _stake.stakedToken = stakedTokenAddress;
    _stake.amount = amount;
    _stake.stakeTime = block.timestamp;

    // Update pool data
    if (pool.totalStaked > 0) {
      for (uint8 i = 0; i < pool.farmingSequence.length; i++) {
        pool.rewardsAccPerShare[i] = pool.rewardsAccPerShare[i]
          + (block.number - pool.lastOperationBlock) * pool.rewardRates[i] / pool.totalStaked;

        _stake.stakeAcc[i] = pool.rewardsAccPerShare[i];
      }
    }

    pool.totalStaked+= amount;
    pool.lastOperationBlock = block.number;

    stakes[msg.sender].push(_stake);
  }

  function unstake(address userAddress, uint256 stakeIdx) external whenNotPaused {
    //TODO: implement
  }

}
