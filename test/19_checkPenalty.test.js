const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,
    time,
    constants,
    expectRevert
} = require('@openzeppelin/test-helpers');

contract("check penalty logic", async accounts => {
    const [ deployer, firstAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken;
    let firstTokenAddress, secondTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000

    let stakeAmount = 1000;

    beforeEach(async () => {
        // tokens deployed
        firstToken = await FirstToken.new({ from: deployer });
        firstTokenAddress = firstToken.address;

        secondToken = await SecondToken.new({ from: deployer });
        secondTokenAddress = secondToken.address;

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

    it("should not be penalty with maxPenalty zero", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        let tokenRewards = [1];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));

        const maxPenalty = new BN(0);
        const penaltyDuration = 45 * 24 * 3600;

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits)
            ],
            maxPenalty, penaltyDuration, deployer,
            constants.ZERO_ADDRESS,
            0)

        await firstToken.transfer(bRingFarmingAddress, (new BN(maxStakeAmount)).mul(tokenbits), { from: deployer });
        let tokenContractBalance = await firstToken.balanceOf.call(bRingFarmingAddress);
        assert.equal(tokenContractBalance.valueOf(), Number((new BN(maxStakeAmount)).mul(tokenbits)), `contract balance is wrong`);

        await firstToken.transfer(firstAddr, (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
        let userBalance = await firstToken.balanceOf.call(firstAddr);
        assert.equal(userBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), `user tokens balance is wrong`);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });

        assert.equal(stakeDetails[0].length, 1, `user number of stake is wrong`);
        assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `user stake amount is wrong`);

        let timesPassed = 1;
        await time.increase(time.duration.hours(timesPassed));

        let penaltyInfo = await bRingFarming.getPoolPenaltyInfo(firstTokenAddress, { from: firstAddr });
        assert.equal(Number(penaltyInfo.penaltyPercent), 0, "penalty percent is wrong");

        let userStakingDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeStartTime = Number(userStakingDetails[3][0]);

        let poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        let totalStaked = Number(poolData.totalStaked);
        let rewRatePerTime = 0.001;
        
        let afterTimesPassed = stakeStartTime + (timesPassed * 3600);
        let reward = stakeAmount * (( afterTimesPassed - stakeStartTime ) / totalStaked) * rewRatePerTime * 0.9;

        let stakeId = stakeDetails[0][0];

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        let balance = Number(await firstToken.balanceOf.call(firstAddr, { from: firstAddr })) / tokenbits;
        
        assert.equal(balance.toFixed(2), (reward * tokenbits).toFixed(2), "user balance is wrong");
    })

    it("should not be penalty with penaltyDuration zero", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        let tokenRewards = [1];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));
        const maxPenalty = new BN(30);
        const penaltyDuration = 0;

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits)
            ],
            maxPenalty, penaltyDuration, deployer,
            constants.ZERO_ADDRESS,
            0)

        await firstToken.transfer(bRingFarmingAddress, (new BN(maxStakeAmount)).mul(tokenbits), { from: deployer });
        let tokenContractBalance = await firstToken.balanceOf.call(bRingFarmingAddress);
        assert.equal(tokenContractBalance.valueOf(), Number((new BN(maxStakeAmount)).mul(tokenbits)), `contract balance is wrong`);

        await firstToken.transfer(firstAddr, (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
        let userBalance = await firstToken.balanceOf.call(firstAddr);
        assert.equal(userBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), `user tokens balance is wrong`);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });

        assert.equal(stakeDetails[0].length, 1, `user number of stake is wrong`);
        assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `user stake amount is wrong`);

        let timesPassed = 1;
        await time.increase(time.duration.hours(timesPassed));

        let userStakingDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeStartTime = Number(userStakingDetails[3][0]);

        let poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        let totalStaked = Number(poolData.totalStaked);
        let rewRatePerTime = 0.001;
        
        let afterTimesPassed = stakeStartTime + (timesPassed * 3600);
        let reward = stakeAmount * (( afterTimesPassed - stakeStartTime ) / totalStaked) * rewRatePerTime * 0.9;

        let stakeId = stakeDetails[0][0];

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        let balance = Number(await firstToken.balanceOf.call(firstAddr, { from: firstAddr })) / tokenbits;
        
        assert.equal(balance.toFixed(2), (reward * tokenbits).toFixed(2), "user balance is wrong");
    })

})