// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BRingFarmingOwnable.sol";

contract BRingFarming is BRingFarmingOwnable {

  uint256 private constant ACC_PRECISION = 1e12;
  uint256 private constant PENALTY_PRECISION = 1e12;

  function stake(address referrer, address stakedTokenAddress, uint256 amount) external whenNotPaused {
    require(amount > 0, "Invalid stake amount value");
    require(block.timestamp < contractDeploymentTime + stakingDuration, "Staking is finished");

    User storage user = users[msg.sender];
    Pool storage pool = pools[stakedTokenAddress];

    require(amount >= pool.minStakeAmount && amount <= pool.maxStakeAmount, "Invalid stake amount value");
    require(pool.totalStakeLimit == 0 || (pool.totalStaked + amount <= pool.totalStakeLimit), "This pool is fulfilled");

    // Validate pool object
    require(pool.farmingSequence.length > 0, "Pool doesn't exist");

    // Update user data
    user.registrationTime = block.timestamp;
    if (user.referrer == address(0x0) && (referrer != address(0x0) && referrer != msg.sender && isActiveUser(referrer))) {
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
    for (uint8 i = 0; i < pool.farmingSequence.length; i++) {
      pool.rewardsAccPerShare[i] = getRewardAccumulatedPerShare(pool, i);

      _stake.stakeAcc[i] = pool.rewardsAccPerShare[i];
    }

    pool.totalStaked+= amount;
    pool.lastOperationTime = block.timestamp;

    stakes[msg.sender].push(_stake);

    emit Stake(msg.sender, _stake.idx, stakedTokenAddress, amount, block.timestamp);
  }

  function _unstake(address userAddress, uint256 stakeIdx) private {
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
    pool.lastOperationTime = block.timestamp;
    if (pool.lastOperationTime > contractDeploymentTime + stakingDuration) {
      pool.lastOperationTime = contractDeploymentTime + stakingDuration;
    }

    emit Unstake(userAddress, stakeIdx, _stake.stakedTokenAddress, _stake.amount, block.timestamp);
  }

  function claimReward(uint256 stakeIdx) external whenNotPaused {
    require(stakeIdx < stakes[msg.sender].length, "Invalid stake index");

    StakeData storage _stake = stakes[msg.sender][stakeIdx];
    require(_stake.unstakeTime == 0, "Stake was unstaked already");

    Pool storage pool = pools[_stake.stakedTokenAddress];
    distributeReward(msg.sender, _stake, pool, true);

    pool.lastOperationTime = block.timestamp;
    if (pool.lastOperationTime > contractDeploymentTime + stakingDuration) {
      pool.lastOperationTime = contractDeploymentTime + stakingDuration;
    }

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

      uint256 reward = _stake.amount
        * (pool.rewardsAccPerShare[i] - _stake.stakeAcc[i])
        / ACC_PRECISION;

      uint256 userReward = _stake.amount
        * (pool.rewardsAccPerShare[i] - _stake.stakeAcc[i])
        * (100 * PENALTY_PRECISION - getPenaltyPercent(pool))
        / 100
        / PENALTY_PRECISION
        / ACC_PRECISION;

      if (updateStakeAccs) {
        _stake.stakeAcc[i] = pool.rewardsAccPerShare[i];
      }

      // Transfer reward and pay referral reward
      if (users[userAddress].referrer == address(0x0)) {
        IERC20(pool.farmingSequence[i]).transfer(userAddress, reward * 90 / 100);
        emit RewardPayout(userAddress, _stake.idx, _stake.stakedTokenAddress, pool.farmingSequence[i], reward * 90 / 100, block.timestamp);
      } else {
        IERC20(pool.farmingSequence[i]).transfer(userAddress, userReward * 94 / 100);
        if (reward > userReward) {
          IERC20(pool.farmingSequence[i]).transfer(pool.penaltyReceiver, (reward - userReward) * 94 / 100);
        }
        emit RewardPayout(userAddress, _stake.idx, _stake.stakedTokenAddress, pool.farmingSequence[i], reward * 94 / 100, block.timestamp);

        address refTokenAddress = pool.farmingSequence[i];
        if (pool.referralRewardTokenAddress != address(0x0)) {
          refTokenAddress = pool.referralRewardTokenAddress;
        }

        address ref = users[userAddress].referrer;
        for (uint8 j = 0; j < referralPercents.length && ref != address(0x0); j++) {
          uint256 refReward;
          if (pool.referralRewardTokenAddress == address(0x0)) {
            refReward = reward * referralPercents[j] / 100;
          } else {
            refReward = reward * referralPercents[j] * pool.referralMultiplier / 10**REFERRAL_MULTIPLIER_DECIMALS / 100;
          }

          IERC20(refTokenAddress).transfer(ref, refReward);
          emit ReferralPayout(
            ref,
            userAddress,
            users[ref].referrer,
            refTokenAddress,
            referralPercents[j],
            refReward,
            block.timestamp
          );

          ref = users[ref].referrer;
        }
      }
    }
  }

  function getRewardAccumulatedPerShare(Pool memory pool, uint8 farmingSequenceIdx) override internal view returns (uint256) {
    uint256 actualTime = block.timestamp;
    if (actualTime > contractDeploymentTime + stakingDuration) {
      actualTime = contractDeploymentTime + stakingDuration;
    }

    if (actualTime <= pool.lastOperationTime || pool.totalStaked == 0) {
      return pool.rewardsAccPerShare[farmingSequenceIdx];
    }

    return pool.rewardsAccPerShare[farmingSequenceIdx]
        + ACC_PRECISION * (actualTime - pool.lastOperationTime) * pool.rewardRates[farmingSequenceIdx] / pool.totalStaked;
  }

  function getStakeRewards(address userAddress, uint256 stakeIdx, bool afterPenalty) external view returns (uint256[10] memory rewards) {
    StakeData memory _stake = stakes[userAddress][stakeIdx];
    Pool memory pool = pools[_stake.stakedTokenAddress];

    if (pool.totalStaked == 0 || _stake.unstakeTime > 0) {
      return rewards;
    }

    for (uint8 i = 0; i < pool.farmingSequence.length; i++) {
      rewards[i] = (getRewardAccumulatedPerShare(pool, i) - _stake.stakeAcc[i])
        * _stake.amount
        * (afterPenalty ? ((100 * PENALTY_PRECISION - getPenaltyPercent(pool))
        / 100
        / PENALTY_PRECISION) : 1)
        / ACC_PRECISION;
    }
  }

  function getPenaltyPercent(Pool memory pool) public view returns(uint256) {
    if (pool.maxPenalty == 0 || pool.penaltyDuration == 0) {
      return 0;
    }

    uint256 time = block.timestamp - contractDeploymentTime;
    if (time >= pool.penaltyDuration) {
      return 0;
    }

    return pool.maxPenalty * (pool.penaltyDuration - time) * PENALTY_PRECISION / pool.penaltyDuration;
  }

  /**
   * Returns user's staking details.
   *
   * @param userAddress Address of the user.
   *
   * @return Tuple with the next elements:
   *      - List of the stakes idxs.
   *      - List of the stakes staked tokens addresses.
   *      - List of the stakes amounts.
   *      - List of the stakes start timestamps.
   *      - List of the stakes unstake timestamps
   *        (stake's activity may be detected by this value (equal 0 - is active))
   *      - List of the stakes block numbers.
   */
  function viewStakingDetails(address userAddress) external view
    returns (
      uint256[] memory,
      address[] memory,
      uint256[] memory,
      uint256[] memory,
      uint256[] memory
    )
  {
    uint256[] memory idxs = new uint256[](stakes[userAddress].length);
    address[] memory stakedTokenAddresses = new address[](stakes[userAddress].length);
    uint256[] memory amounts = new uint256[](stakes[userAddress].length);
    uint256[] memory stakeTimes = new uint256[](stakes[userAddress].length);
    uint256[] memory unstakeTimes = new uint256[](stakes[userAddress].length);

    for (uint8 i = 0; i < uint8(stakes[userAddress].length); i++) {
      idxs[i] = stakes[userAddress][i].idx;
      stakedTokenAddresses[i] = stakes[userAddress][i].stakedTokenAddress;
      amounts[i] = stakes[userAddress][i].amount;
      stakeTimes[i] = stakes[userAddress][i].stakeTime;
      unstakeTimes[i] = stakes[userAddress][i].unstakeTime;
    }

    return (
      idxs, stakedTokenAddresses, amounts, stakeTimes, unstakeTimes
    );
  }

  function isActiveUser(address userAddress) public view returns (bool) {
    return (users[userAddress].registrationTime > 0);
  }

  function getReferrals(address userAddress) public view returns (address[] memory) {
    return users[userAddress].referrals;
  }

  function getReferralsNumber(address userAddress) public view returns (uint256) {
    return users[userAddress].referrals.length;
  }

}
