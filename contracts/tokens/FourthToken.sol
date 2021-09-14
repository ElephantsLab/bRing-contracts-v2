// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract FourthToken is ERC20 {
    constructor () ERC20("Token", "FourthToken") {
        _mint(msg.sender, 100000000 * (10 ** uint256(decimals())));    
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}