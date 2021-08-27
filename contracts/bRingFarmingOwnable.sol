// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct Pool {
  uint256 minStakeAmount;
  uint256 maxStakeAmount;
  uint256 totalStakeLimit;
  address[] farmingSequence;
  uint256[] rewardRates;

  uint256[] rewardsAccPerShare;
  uint256 lastOperationBlock;
  uint256 totalStaked;
}

struct User {
  address referrer;
  address[] referrals;
}

struct Stake {
  uint256 idx;
  address stakedToken;
  uint256 amount;
  uint256[] stakeAcc;
  uint256 stakeTime;
  uint256 unstakeTime;
  //TODO: add stake and unstake block numbers
}

abstract contract BRingFarmingOwnable is Ownable, Pausable {

  address[] public poolAddresses;
  mapping(address => Pool) public pools;

  mapping(address => User) public users;
  mapping(address => Stake[]) public stakes;

  uint256 public stakingDuration;
  uint256 public contractDeploymentTime;

  uint256 public stakeMultiplier;

  uint256[] public referralPercents = [3, 2, 1]; // 3%, 2%, 1%
  uint256 public totalReferralPercent;

  constructor() {
    stakingDuration = 90 * 24 * 3600; // 90 days
    stakeMultiplier = 3;

    for (uint8 i = 0; i < referralPercents.length; i++) {
      totalReferralPercent+= referralPercents[i];
    }

    contractDeploymentTime = block.timestamp;
  }

  function changeStakingDuration(uint256 _days) external onlyOwner {
    require(_days > 0, "Invalid number of days");

    stakingDuration = _days * 24 * 3600;
  }

  function changeStakeMultiplier(uint256 _multiplier) external onlyOwner {
    require(_multiplier > 0, "Invalid multiplier value");

    stakeMultiplier = _multiplier;
  }

  function changeReferralPercents(uint256[] memory _referralPercents) external onlyOwner {
    require(_referralPercents.length > 0, "Invalid referral percents array data");

    referralPercents = _referralPercents;
    totalReferralPercent = 0;
    for (uint8 i = 0; i < referralPercents.length; i++) {
      totalReferralPercent+= referralPercents[i];
    }
  }

  /**
   * Farming pools configuration method. New pools should be created with this method or old pools
   * may be updated with this method.
   *
   * @param stakedTokenAddress Address of the staked token contract.
   * @param farmingSequence List of farming tokens addresses.
   * @param rewardRates List of rewards per block for every token from the farming sequence list.
   */
  function configPool(
    address stakedTokenAddress,
    uint256 minStakeAmount,
    uint256 maxStakeAmount,
    uint256 totalStakeLimit,
    address[] memory farmingSequence,
    uint256[] memory rewardRates
  ) external onlyOwner {
    require(stakedTokenAddress != address(0x0), "Invalid token contract address");
    require(minStakeAmount > 0 && minStakeAmount < maxStakeAmount, "Invalid min or max stake amounts values");
    require(maxStakeAmount < totalStakeLimit, "Invalid total stake limit value");
    require(farmingSequence.length > 0 && farmingSequence.length == rewardRates.length, "Invalid configuration data");

    pools[stakedTokenAddress].minStakeAmount = minStakeAmount;
    pools[stakedTokenAddress].maxStakeAmount = maxStakeAmount;
    pools[stakedTokenAddress].totalStakeLimit = totalStakeLimit;

    if (pools[stakedTokenAddress].farmingSequence.length == 0) {
      poolAddresses.push(stakedTokenAddress);
    }

    pools[stakedTokenAddress].farmingSequence = farmingSequence;
    pools[stakedTokenAddress].rewardRates = rewardRates;
  }

  /**
   * Owner can use this method to forcibly unstake some stake and point out reward amounts manually.
   *
   * @param userAddress Address of the stake owner.
   * @param stakeIdx Id of the users' stake.
   * @param rewards Manually pointed out rewards array.
   * @param payReferralRewards Pay referral rewards flag.
   */
  function emergencyUnstake(
    address userAddress,
    uint256 stakeIdx,
    uint256[] memory rewards,
    bool payReferralRewards
  ) external onlyOwner {
    require(stakeIdx < stakes[userAddress].length, "Invalid stake index");

    Stake storage _stake = stakes[userAddress][stakeIdx];
    require(_stake.unstakeTime == 0, "Stake was unstaked already");

    Pool storage pool = pools[_stake.stakedToken];
    require(pool.farmingSequence.length == rewards.length, "Incorrect rewards array length");

    // Update stake
    _stake.unstakeTime = block.timestamp;

    for (uint8 i = 0; i < pool.farmingSequence.length; i++) {
      pool.rewardsAccPerShare[i] = getRewardAccumulatedPerShare(pool, i);

      if (rewards[i] == 0) {
        continue;
      }

      // Transfer reward and pay referral reward
      if (users[userAddress].referrer == address(0x0)) {
        IERC20(pool.farmingSequence[i]).transfer(userAddress, rewards[i] * 90 / 100);
      } else {
        IERC20(pool.farmingSequence[i]).transfer(userAddress, rewards[i] * 94 / 100);
        if (!payReferralRewards) {
          continue;
        }
        address ref = users[userAddress].referrer;
        for (uint8 j = 0; j < referralPercents.length && ref != address(0x0); j++) {
          IERC20(pool.farmingSequence[i]).transfer(ref, rewards[i] * referralPercents[j] / 100);

          ref = users[ref].referrer;
        }
      }
    }

    // Return stake
    IERC20(_stake.stakedToken).transfer(userAddress, _stake.amount);

    pool.totalStaked-= _stake.amount;
    pool.lastOperationBlock = block.number;
  }

  function retrieveTokens(address _tokenAddress, uint256 _amount) external onlyOwner {
    require(_amount > 0, "Invalid amount");

    require(
      IERC20(_tokenAddress).balanceOf(address(this)) >= _amount,
      "Insufficient Balance"
    );
    require(
      IERC20(_tokenAddress).transfer(owner(), _amount),
      "Transfer failed"
    );
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }

  function getRewardAccumulatedPerShare(Pool memory pool, uint8 farmingSequenceIdx) virtual internal view returns (uint256);
  
}
