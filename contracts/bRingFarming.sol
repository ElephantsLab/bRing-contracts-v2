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
        pool.rewardsAccPerShare[i] = getRewardAccumulatedPerShare(pool, i);

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

  function getRewardAccumulatedPerShare(Pool memory pool, uint8 farmingSequenceIdx) private view returns (uint256) {
    return pool.rewardsAccPerShare[farmingSequenceIdx]
        + (block.number - pool.lastOperationBlock) * pool.rewardRates[farmingSequenceIdx] / pool.totalStaked;
  }

  function getStakeRewards(address userAddress, uint256 stakeIdx) external view returns (uint256[10] memory rewards) {
    Stake memory _stake = stakes[userAddress][stakeIdx];
    Pool memory pool = pools[_stake.stakedToken];

    if (pool.totalStaked == 0 || _stake.unstakeTime > 0) {
      return rewards;
    }

    for (uint8 i = 0; i < pool.farmingSequence.length; i++) {
      rewards[i] = (getRewardAccumulatedPerShare(pool, i) - _stake.stakeAcc[i]) * _stake.amount;
    }
  }

}
