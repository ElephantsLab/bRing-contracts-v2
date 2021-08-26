// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BRingFarmingOwnable.sol";

contract BRingFarming is BRingFarmingOwnable {

  mapping(address => User) public users;
  mapping(address => Stake[]) public stakes;

  function stake(address referrer, address stakedTokenAddress, uint256 amount) external whenNotPaused {
    require(block.timestamp < contractDeploymentTime + stakingDuration, "Staking is finished");

    User storage user = users[msg.sender];
    Pool storage pool = pools[stakedTokenAddress];

    // Validate pool object
    require(pool.farmingSequence.length > 0, "Pool doesn't exist");

    // Update user data
    if (user.referrer == address(0x0) && referrer != address(0x0)) {
      user.referrer = referrer;
      users[referrer].referrals.push(msg.sender);
    }

    //TODO: transfer staked tokens from the user address

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
    require(stakeIdx < stakes[userAddress].length, "Invalid stake index");

    Stake storage _stake = stakes[userAddress][stakeIdx];
    require(_stake.unstakeTime == 0, "Stake was unstaked already");

    // Update stake
    _stake.unstakeTime = block.timestamp;

    Pool storage pool = pools[_stake.stakedToken];
    for (uint8 i = 0; i < pool.farmingSequence.length; i++) {
      pool.rewardsAccPerShare[i] = getRewardAccumulatedPerShare(pool, i);

      uint256 reward = _stake.amount * (pool.rewardsAccPerShare[i] - _stake.stakeAcc[i]);
      reward*= getStakeMultiplier(_stake);

      // Transfer reward and pay referral reward
      if (users[msg.sender].referrer == address(0x0)) {
        IERC20(pool.farmingSequence[i]).transfer(msg.sender, reward * 90 / 100);
      } else {
        IERC20(pool.farmingSequence[i]).transfer(msg.sender, reward * 94 / 100);
        address ref = users[msg.sender].referrer;
        for (uint8 j = 0; j < referralPercents.length && ref != address(0x0); j++) {
          IERC20(pool.farmingSequence[i]).transfer(ref, reward * referralPercents[j] / 100);

          ref = users[ref].referrer;
        }
      }
    }

    // Return stake
    IERC20(_stake.stakedToken).transfer(msg.sender, _stake.amount);

    pool.totalStaked-= _stake.amount;
    pool.lastOperationBlock = block.number;
  }

  function claimReward(address userAddress, uint256 stakeIdx) external whenNotPaused {
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
      rewards[i]*= getStakeMultiplier(_stake);
    }
  }

  function getStakeMultiplier(Stake memory _stake) private view returns (uint256) {
    uint256 currentStakeTime = block.timestamp;
    if (contractDeploymentTime + stakingDuration < currentStakeTime) {
      currentStakeTime = contractDeploymentTime + stakingDuration;
    }

    return 1 + (stakeMultiplier - 1) * (currentStakeTime - _stake.stakeTime) / stakingDuration;
  }

}
