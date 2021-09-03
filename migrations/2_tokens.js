const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");
const FourthToken = artifacts.require("FourthToken");

module.exports = function (deployer) {
    deployer.deploy(FirstToken);
    deployer.deploy(SecondToken);
    deployer.deploy(ThirdToken);
    deployer.deploy(FourthToken);
};