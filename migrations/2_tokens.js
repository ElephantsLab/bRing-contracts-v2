const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

module.exports = function (deployer) {
    deployer.deploy(FirstToken);
    deployer.deploy(SecondToken);
    deployer.deploy(ThirdToken);
};