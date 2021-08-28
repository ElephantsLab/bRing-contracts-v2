// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BRingFarmingOwnable.sol";

contract BRingFarming is BRingFarmingOwnable {

  function stake(address referrer, address stakedTokenAddress, uint256 amount) external whenNotPaused {
    require(amount > 0, "Invalid stake amount value");
    require(block.timestamp < contractDeploymentTime + stakingDuration, "Staking is finished");

    User storage user = users[msg.sender];
    Pool storage pool = pools[stakedTokenAddress];

    require(amount >= pool.minStakeAmount && amount <= pool.maxStakeAmount, "Invalid stake amount value");
    require(pool.totalStaked + amount <= pool.totalStakeLimit, "This pool is fulfilled");

    // Validate pool object
    require(pool.farmingSequence.length > 0, "Pool doesn't exist");

    // Update user data
    if (user.referrer == address(0x0) && (referrer != address(0x0) && referrer != msg.sender)) {
      user.referrer = referrer;
      users[referrer].referrals.push(msg.sender);

      emit NewReferralConnection(msg.sender, referrer, block.timestamp);
    }

    // Transfer staked tokens from the user address
    require(
      IERC20(stakedTokenAddress).transferFrom(msg.sender, address(this), amount),
      "Tokens stake deposit error"
    );

    // Create stake
    StakeData memory _stake;
    _stake.idx = stakes[msg.sender].length;
    _stake.stakedTokenAddress = stakedTokenAddress;
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

    emit Stake(msg.sender, _stake.idx, stakedTokenAddress, amount, block.timestamp);
  }

  function _unstake(address userAddress, uint256 stakeIdx) private whenNotPaused {
    require(stakeIdx < stakes[userAddress].length, "Invalid stake index");

    StakeData storage _stake = stakes[userAddress][stakeIdx];
    require(_stake.unstakeTime == 0, "Stake was unstaked already");

    // Update stake
    _stake.unstakeTime = block.timestamp;

    Pool storage pool = pools[_stake.stakedTokenAddress];
    distributeReward(userAddress, _stake, pool, false);

    // Return stake
    IERC20(_stake.stakedTokenAddress).transfer(userAddress, _stake.amount);

    pool.totalStaked-= _stake.amount;
    pool.lastOperationBlock = block.number;

    emit Unstake(userAddress, stakeIdx, _stake.stakedTokenAddress, _stake.amount, block.timestamp);
  }

  function claimReward(uint256 stakeIdx) external whenNotPaused {
    require(stakeIdx < stakes[msg.sender].length, "Invalid stake index");

    StakeData storage _stake = stakes[msg.sender][stakeIdx];
    require(_stake.unstakeTime == 0, "Stake was unstaked already");

    Pool storage pool = pools[_stake.stakedTokenAddress];
    distributeReward(msg.sender, _stake, pool, true);

    pool.lastOperationBlock = block.number;

    emit Claim(msg.sender, stakeIdx, _stake.stakedTokenAddress, block.timestamp);
  }

  function unstake(uint256 stakeIdx) external whenNotPaused {
    _unstake(msg.sender, stakeIdx);
  }

  function unstakeForAddress(address userAddress, uint256 stakeIdx) external onlyOwner {
    _unstake(userAddress, stakeIdx);
  }

  function distributeReward(address userAddress, StakeData storage _stake, Pool storage pool, bool updateStakeAccs) private {
    for (uint8 i = 0; i < pool.farmingSequence.length; i++) {
      pool.rewardsAccPerShare[i] = getRewardAccumulatedPerShare(pool, i);
      if (updateStakeAccs) {
        _stake.stakeAcc[i] = pool.rewardsAccPerShare[i];
      }

      uint256 reward = _stake.amount * (pool.rewardsAccPerShare[i] - _stake.stakeAcc[i]);
      reward*= getStakeMultiplier(_stake);

      // Transfer reward and pay referral reward
      if (users[userAddress].referrer == address(0x0)) {
        IERC20(pool.farmingSequence[i]).transfer(userAddress, reward * 90 / 100);
        emit RewardPayout(userAddress, _stake.idx, _stake.stakedTokenAddress, pool.farmingSequence[i], reward * 90 / 100, block.timestamp);
      } else {
        IERC20(pool.farmingSequence[i]).transfer(userAddress, reward * 94 / 100);
        emit RewardPayout(userAddress, _stake.idx, _stake.stakedTokenAddress, pool.farmingSequence[i], reward * 94 / 100, block.timestamp);

        address ref = users[userAddress].referrer;
        for (uint8 j = 0; j < referralPercents.length && ref != address(0x0); j++) {
          IERC20(pool.farmingSequence[i]).transfer(ref, reward * referralPercents[j] / 100);
          emit ReferralPayout(
            ref,
            userAddress,
            users[ref].referrer,
            pool.farmingSequence[i],
            referralPercents[j],
            reward * referralPercents[j] / 100,
            block.timestamp
          );

          ref = users[ref].referrer;
        }
      }
    }
  }

  function getRewardAccumulatedPerShare(Pool memory pool, uint8 farmingSequenceIdx) override internal view returns (uint256) {
    return pool.rewardsAccPerShare[farmingSequenceIdx]
        + (block.number - pool.lastOperationBlock) * pool.rewardRates[farmingSequenceIdx] / pool.totalStaked;
  }

  function getStakeRewards(address userAddress, uint256 stakeIdx) external view returns (uint256[10] memory rewards) {
    StakeData memory _stake = stakes[userAddress][stakeIdx];
    Pool memory pool = pools[_stake.stakedTokenAddress];

    if (pool.totalStaked == 0 || _stake.unstakeTime > 0) {
      return rewards;
    }

    for (uint8 i = 0; i < pool.farmingSequence.length; i++) {
      rewards[i] = (getRewardAccumulatedPerShare(pool, i) - _stake.stakeAcc[i]) * _stake.amount;
      rewards[i]*= getStakeMultiplier(_stake);
    }
  }

  function getStakeMultiplier(StakeData memory _stake) private view returns (uint256) {
    uint256 currentStakeTime = block.timestamp;
    if (contractDeploymentTime + stakingDuration < currentStakeTime) {
      currentStakeTime = contractDeploymentTime + stakingDuration;
    }

    return 1 + (stakeMultiplier - 1) * (currentStakeTime - _stake.stakeTime) / stakingDuration;
  }

}
