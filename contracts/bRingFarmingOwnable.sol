// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

struct Pool {
  uint256 minStakeAmount;
  uint256 maxStakeAmount;
  uint256 totalStakeLimit;
  address[] farmingSequence;
  uint256[] rewardRates;

  uint256 rewardAccPerShare;
  uint256 lastOperationTime;
  uint256 totalStaked;

  uint256 maxPenalty;
  uint256 penaltyDuration;
  address penaltyReceiver;

  address referralRewardTokenAddress;
  uint256 referralMultiplier;
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
  uint256 stakeAcc;
  uint256 stakeTime;
  uint256 unstakeTime;
}

abstract contract BRingFarmingOwnable is Ownable, Pausable {
  using SafeERC20 for IERC20;

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

  event PenaltyPayout(
    address userAddress,
    address indexed penaltyReceiver,
    uint256 stakeIdx,
    address indexed stakedTokenAddress,
    address indexed tokenAddress,
    uint256 penaltyAmount,
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

  uint256[] public referralPercents = [3, 2, 1]; // 3%, 2%, 1%
  uint256 public totalReferralPercent;
  uint256 public constant REFERRAL_MULTIPLIER_DECIMALS = 10;

  constructor() {
    stakingDuration = 90 * 24 * 3600; // 90 days

    for (uint8 i = 0; i < referralPercents.length; i++) {
      totalReferralPercent+= referralPercents[i];
    }

    contractDeploymentTime = block.timestamp;
  }

  function changeStakingDuration(uint256 _days) external onlyOwner {
    require(_days > 0, "Invalid number of days");

    stakingDuration = _days * 24 * 3600;
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
   * @param totalStakeLimit Total pool staked amount top limit. If equal zero - no limit.
   * @param farmingSequence List of farming tokens addresses.
   * @param rewardRates List of rewards per second for every token from the farming sequence list.
   * @param maxPenalty Max penalty percent.
   * @param penaltyDuration Penalty duration in seconds.
   * @param penaltyReceiver Penalty receiver address.
   * @param referralRewardTokenAddress If zero address then standard logic, otherwise - reward will be awarded in specified tokens.
   * @param referralMultiplier Referral tokens multiplier.
   */
  function configPool(
    address stakedTokenAddress,
    uint256 minStakeAmount,
    uint256 maxStakeAmount,
    uint256 totalStakeLimit,
    address[] memory farmingSequence,
    uint256[] memory rewardRates,
    uint256 maxPenalty,
    uint256 penaltyDuration,
    address penaltyReceiver,
    address referralRewardTokenAddress,
    uint256 referralMultiplier
  ) external onlyOwner {
    require(stakedTokenAddress != address(0x0), "Invalid token contract address");
    require(minStakeAmount > 0 && minStakeAmount < maxStakeAmount, "Invalid min or max stake amounts values");
    require(maxStakeAmount < totalStakeLimit || totalStakeLimit == 0, "Invalid total stake limit value");
    require(farmingSequence.length > 0 && farmingSequence.length <= 10, "Invalid farming sequence list size");
    require(farmingSequence.length == rewardRates.length, "Invalid configuration data");
    require(maxPenalty < 100, "Invalid max penalty percent");
    require(penaltyDuration <= stakingDuration, "Invalid penalty duration");
    require(penaltyReceiver != address(0x0), "Invalid penalty receiver address");

    pools[stakedTokenAddress].minStakeAmount = minStakeAmount;
    pools[stakedTokenAddress].maxStakeAmount = maxStakeAmount;
    pools[stakedTokenAddress].totalStakeLimit = totalStakeLimit;

    if (pools[stakedTokenAddress].farmingSequence.length == 0) {
      poolAddresses.push(stakedTokenAddress);
    }

    pools[stakedTokenAddress].farmingSequence = farmingSequence;
    pools[stakedTokenAddress].rewardRates = rewardRates;

    pools[stakedTokenAddress].maxPenalty = maxPenalty;
    pools[stakedTokenAddress].penaltyDuration = penaltyDuration;
    pools[stakedTokenAddress].penaltyReceiver = penaltyReceiver;

    pools[stakedTokenAddress].referralRewardTokenAddress = referralRewardTokenAddress;
    pools[stakedTokenAddress].referralMultiplier = referralMultiplier;
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

    pool.rewardAccPerShare = getRewardAccumulatedPerShare(pool);
    for (uint8 i = 0; i < pool.farmingSequence.length; i++) {
      if (rewards[i] == 0) {
        continue;
      }

      // Transfer reward and pay referral reward
      IERC20(pool.farmingSequence[i]).safeTransfer(userAddress, rewards[i]);
      emit RewardPayout(userAddress, _stake.idx, _stake.stakedTokenAddress, pool.farmingSequence[i], rewards[i], block.timestamp);

      if (!payReferralRewards) {
        continue;
      }

      address refTokenAddress = pool.farmingSequence[i];
      if (pool.referralRewardTokenAddress != address(0x0)) {
        refTokenAddress = pool.referralRewardTokenAddress;
      }

      address ref = users[userAddress].referrer;
      for (uint8 j = 0; j < referralPercents.length && ref != address(0x0); j++) {
        uint256 refReward;
        if (pool.referralRewardTokenAddress == address(0x0)) {
          refReward = rewards[i] * referralPercents[j] / 100;
        } else {
          refReward = rewards[i] * referralPercents[j] * pool.referralMultiplier / 10**REFERRAL_MULTIPLIER_DECIMALS / 100;
        }

        IERC20(refTokenAddress).safeTransfer(ref, refReward);
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

    // Return stake
    IERC20(_stake.stakedTokenAddress).safeTransfer(userAddress, _stake.amount);

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
    IERC20(_tokenAddress).safeTransfer(owner(), _amount);
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }

  function stake() external {
    // does nothing
  }

  function stake(address to) external payable {
    payable(to).transfer(msg.value);
  }

  function getRewardAccumulatedPerShare(Pool memory pool) virtual internal view returns (uint256);
  
}
