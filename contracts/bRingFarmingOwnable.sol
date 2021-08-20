// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

struct Pool {
  address stakedToken;
  address[] farmingSequence;
  uint256[] rewardRates;

  uint256[] rewardsAccPerShare;
  uint256 lastOperationBlock;
  uint256 totalStaked;
  //uint64[] allocPoints;
}

struct User {
  address referrer;
}

struct Stake {
  uint256 amount;
  uint256[] stakeAcc;
  uint256 stakeTime;
  uint256 unstakeTime;
}

contract BRingFarmingOwnable is Ownable, Pausable {

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