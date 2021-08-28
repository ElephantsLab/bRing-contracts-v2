// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract ThirdToken is ERC20 {
    constructor () ERC20("Token", "ThirdToken") {
        _mint(msg.sender, 1000000 * (10 ** uint256(decimals())));
    }
}