const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    expectEvent,  // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
    time
} = require('@openzeppelin/test-helpers');

contract("check functionality of bRingFarmingOwnable", async accounts => {
    const [ deployer, anotherWallet ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, thirdToken;
    let firstTokenAddress, secondTokenAddress, thirdTokenAddress;

    before(async () => {
        // tokens deployed
        firstToken = await FirstToken.deployed({ from: deployer });
        firstTokenAddress = firstToken.address;

        secondToken = await SecondToken.deployed({ from: deployer });
        secondTokenAddress = secondToken.address;

        thirdToken = await ThirdToken.deployed({ from: deployer });
        thirdTokenAddress = thirdToken.address;

        // contract deployed
        bRingFarming = await bRingFarmingContract.deployed({ from: deployer });
        bRingFarmingAddress = bRingFarming.address;
    })

    it("should revert for NOT owner caller func changeStakingDuration", async () => {
        const stakingDuration = new BN(10);

        await expectRevert(
            bRingFarming.changeStakingDuration(stakingDuration, {from: anotherWallet}),
            'Ownable: caller is not the owner'
        );
    })

    it("should revert invalid stakingDuration param in func changeStakingDuration", async () => {
        const invalidStakingDuration = new BN(0);

        await expectRevert(
            bRingFarming.changeStakingDuration(invalidStakingDuration, {from: deployer}),
            'Invalid number of days'
        );
    })

    it("owner should be able change staking duration", async () => {
        const stakingDuration = new BN(10);

        await bRingFarming.changeStakingDuration(stakingDuration, {from: deployer});
        let receivedStakingDuration = await bRingFarming.stakingDuration({from: deployer});

        assert.equal((receivedStakingDuration / 24 / 3600), stakingDuration, "staking duration is wrong");
    })

    it("should revert for NOT owner caller func changeStakeMultiplier", async () => {
        const stakeMultiplier = new BN(1);

        await expectRevert(
            bRingFarming.changeStakeMultiplier(stakeMultiplier, {from: anotherWallet}),
            'Ownable: caller is not the owner'
        );
    })

    it("should revert invalid stakeMultiplier param in func changeStakeMultiplier", async () => {
        const invalidStakingDuration = new BN(0);

        await expectRevert(
            bRingFarming.changeStakeMultiplier(invalidStakingDuration, {from: deployer}),
            'Invalid multiplier value'
        );
    });
})