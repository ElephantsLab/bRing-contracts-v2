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

contract BRingFarmingOwnable is Ownable, Pausable {

  address[] public poolAddresses;
  mapping(address => Pool) public pools;

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
    address[] memory farmingSequence,
    uint256[] memory rewardRates
  ) external onlyOwner {
    require(stakedTokenAddress != address(0x0), "Invalid token contract address");
    require(farmingSequence.length > 0 && farmingSequence.length == rewardRates.length, "Invalid configuration data");

    if (pools[stakedTokenAddress].farmingSequence.length == 0) {
      poolAddresses.push(stakedTokenAddress);
    }

    pools[stakedTokenAddress].farmingSequence = farmingSequence;
    pools[stakedTokenAddress].rewardRates = rewardRates;
  }

  function emergencyUnstake() external onlyOwner {
    //TODO: implement
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
  
}