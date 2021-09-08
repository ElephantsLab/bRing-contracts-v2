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

  uint256[10] rewardsAccPerShare;
  uint256 lastOperationTime;
  uint256 totalStaked;
}

struct User {
  uint256 registrationTime;
  address referrer;
  address[] referrals;
}

struct StakeData {
  uint256 idx;
  address stakedTokenAddress;
  uint256 amount;
  uint256[10] stakeAcc;
  uint256 stakeTime;
  uint256 unstakeTime;
}

abstract contract BRingFarmingOwnable is Ownable, Pausable {

  event NewReferralConnection(
    address indexed userAddress,
    address indexed referrerAddress,
    uint256 time
  );

  event Stake(
    address indexed userAddress,
    uint256 stakeIdx,
    address indexed stakedTokenAddress,
    uint256 amount,
    uint256 time
  );

  event Claim(
    address indexed userAddress,
    uint256 stakeIdx,
    address indexed stakedTokenAddress,
    uint256 time
  );

  event Unstake(
    address indexed userAddress,
    uint256 indexed stakeIdx,
    address indexed stakedTokenAddress,
    uint256 amount,
    uint256 time
  );

  event RewardPayout(
    address indexed userAddress,
    uint256 stakeIdx,
    address indexed stakedTokenAddress,
    address indexed tokenAddress,
    uint256 reward,
    uint256 time
  );

  event ReferralPayout(
    address indexed receiverAddress,
    address callerAddress,
    address indexed refererr,
    address indexed rewardTokenAddress,
    uint256 percent,
    uint256 amount,	
    uint256 time
  );

  address[] public poolAddresses;
  mapping(address => Pool) public pools;

  mapping(address => User) public users;
  mapping(address => StakeData[]) public stakes;

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
   * @param minStakeAmount Minimum stake amount.
   * @param maxStakeAmount Maximum stake amount.
   * @param totalStakeLimit Total pool staked amount top limit.
   * @param farmingSequence List of farming tokens addresses.
   * @param rewardRates List of rewards per second for every token from the farming sequence list.
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

    StakeData storage _stake = stakes[userAddress][stakeIdx];
    require(_stake.unstakeTime == 0, "Stake was unstaked already");

    Pool storage pool = pools[_stake.stakedTokenAddress];
    require(pool.farmingSequence.length == rewards.length, "Incorrect rewards array length");

    // Update stake
    _stake.unstakeTime = block.timestamp;

    for (uint8 i = 0; i < pool.farmingSequence.length; i++) {
      pool.rewardsAccPerShare[i] = getRewardAccumulatedPerShare(pool, i);

      if (rewards[i] == 0) {
        continue;
      }

      // Transfer reward and pay referral reward
      IERC20(pool.farmingSequence[i]).transfer(userAddress, rewards[i]);
      emit RewardPayout(userAddress, _stake.idx, _stake.stakedTokenAddress, pool.farmingSequence[i], rewards[i], block.timestamp);

      if (!payReferralRewards) {
        continue;
      }
      address ref = users[userAddress].referrer;
      for (uint8 j = 0; j < referralPercents.length && ref != address(0x0); j++) {
        IERC20(pool.farmingSequence[i]).transfer(ref, rewards[i] * referralPercents[j] / 100);
        emit ReferralPayout(
          ref,
          userAddress,
          users[ref].referrer,
          pool.farmingSequence[i],
          referralPercents[j],
          rewards[i] * referralPercents[j] / 100,
          block.timestamp
        );

        ref = users[ref].referrer;
      }
    }

    // Return stake
    IERC20(_stake.stakedTokenAddress).transfer(userAddress, _stake.amount);

    pool.totalStaked-= _stake.amount;
    pool.lastOperationTime = block.timestamp;

    emit Unstake(userAddress, stakeIdx, _stake.stakedTokenAddress, _stake.amount, block.timestamp);
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
