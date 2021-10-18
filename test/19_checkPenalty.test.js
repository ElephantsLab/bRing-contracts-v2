const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");

const BRingToken = artifacts.require("bRingToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,
    time,
    constants,
    expectRevert
} = require('@openzeppelin/test-helpers');

contract("check penalty logic", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr, sixthAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, BRNGToken;
    let firstTokenAddress, secondTokenAddress, BRNGTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000

    beforeEach(async () => {
        // tokens deployed
        firstToken = await FirstToken.new({ from: deployer });
        firstTokenAddress = firstToken.address;

        secondToken = await SecondToken.new({ from: deployer });
        secondTokenAddress = secondToken.address;

        BRNGToken = await BRingToken.new({ from: deployer });
        BRNGTokenAddress = BRNGToken.address;

        // contract deployed
        bRingFarming = await bRingFarmingContract.new({ from: deployer });
        bRingFarmingAddress = bRingFarming.address;
    })

    it("max penalty percent should NOT be more than 100", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        let tokenRewards = [1, 2];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));
        const maxPenalty = new BN(101);
        const penaltyDuration = 45 * 24 * 3600;

        await expectRevert(
            bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits)
            ],
            maxPenalty, penaltyDuration, deployer,
            constants.ZERO_ADDRESS,
            0),
            'Invalid max penalty percent'
        ); 
    })

    it("penalty duration should NOT be bigger than staking duration", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        let tokenRewards = [1, 2];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));
        const maxPenalty = new BN(30);
        const penaltyDuration = Number(await bRingFarming.stakingDuration()) + 1;

        await expectRevert(
            bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits)
            ],
            maxPenalty, penaltyDuration, deployer,
            constants.ZERO_ADDRESS,
            0),
            'Invalid penalty duration'
        ); 
    })

    it("penalty receiver should NOT be zero address", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        let tokenRewards = [1, 2];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));
        const maxPenalty = new BN(30);
        const penaltyDuration = 45 * 24 * 3600;

        await expectRevert(
            bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits)
            ],
            maxPenalty, penaltyDuration, constants.ZERO_ADDRESS,
            constants.ZERO_ADDRESS,
            0),
            'Invalid penalty receiver address'
        ); 
    })

})