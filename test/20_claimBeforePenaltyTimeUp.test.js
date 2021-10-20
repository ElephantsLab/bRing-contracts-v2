const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,
    time,
    constants
} = require('@openzeppelin/test-helpers');

contract("users make stake and claim before penalty duration time is up", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken;
    let firstTokenAddress, secondTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000 

    let stakeAmount = 10000;

    before(async () => {
        // tokens deployed
        firstToken = await FirstToken.new({ from: deployer });
        firstTokenAddress = firstToken.address;

        secondToken = await SecondToken.new({ from: deployer });
        secondTokenAddress = secondToken.address;

        // contract deployed
        bRingFarming = await bRingFarmingContract.new({ from: deployer });
        bRingFarmingAddress = bRingFarming.address;
    })

    it("config Pool", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        let tokenRewards = [1, 2];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));
        const maxPenalty = new BN(30);
        const penaltyDuration = 45 * 24 * 3600;

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits)
            ],
            maxPenalty, penaltyDuration, deployer,
            constants.ZERO_ADDRESS,
            0)
    })

    it("send tokens to the contract address", async () => {
        let tokenContractBalance;
        let tokensNames = [firstToken, secondToken];

        const firstTokenDecimals = await firstToken.decimals();
        const secondTokenDecimals = await secondToken.decimals();
        const decimals = [firstTokenDecimals, secondTokenDecimals];

        for(let i = 0; i < tokensNames.length; i++){
            let tokenbits = (new BN(10)).pow(decimals[i]);
            await tokensNames[i].transfer(bRingFarmingAddress, (new BN(maxStakeAmount)).mul(tokenbits), { from: deployer });
            tokenContractBalance = await tokensNames[i].balanceOf.call(bRingFarmingAddress);
            assert.equal(tokenContractBalance.valueOf(), Number((new BN(maxStakeAmount)).mul(tokenbits)), `contract ${tokensNames[i]} balance is wrong`);
        }
    })

    it("users should have firstToken in their addresses", async () => {
        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr];
        let userBalance;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        for(let i = 0; i < users.length; i++) {
            await firstToken.transfer(users[i], (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
            userBalance = await firstToken.balanceOf.call(users[i]);
            assert.equal(userBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user tokens balance is wrong`);
        }
    })

    it("users make stakes without referrer", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let users = [firstAddr, thirdAddr, fourthAddr, fifthAddr];
        let stakeDetails;

        for(let i = 0; i < users.length; i++) {          
            await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
            await bRingFarming.stake(users[i], firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });

            stakeDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });

            assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
            assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
        }
    })

    it("second user makes stake with referrer", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: secondAddr });
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: secondAddr });

        let stakeDetails = await bRingFarming.viewStakingDetails(secondAddr, { from: secondAddr });

        assert.equal(stakeDetails[0].length, 1, `user number of stake is wrong`);
        assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `user stake amount is wrong`);
    })

    it("first user makes claim after stake without ref in 1 day", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let daysPassed = 1;
        await time.increase(time.duration.days(daysPassed));

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId,  { from: firstAddr });

        console.log("---- 1st user ----");
        console.log("getStakeRewards firstToken:", (Number(stakeRew[0]) * 0.9) / tokenbits);
        console.log("getStakeRewards secondToken:", (Number(stakeRew[1]) * 0.9) / tokenbits);
        expect((Number(stakeRew[0]) * 0.9)).to.be.above(0);

        let userStakingDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeStartTime = Number(userStakingDetails[3][0]);

        let poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        let totalStaked = Number(poolData.totalStaked);
        let firstRewRatePerTime = 0.001;
        let secondRewRatePerTime = 0.002;

        let penaltyInfo = await bRingFarming.getPoolPenaltyInfo(firstTokenAddress, { from: firstAddr });
        let penaltyPercent = penaltyInfo.penaltyPercent;

        let afterOneDay = stakeStartTime + (daysPassed * 24 * 3600);

        let firstTokenReward = stakeAmount * (( afterOneDay - stakeStartTime ) / totalStaked) * firstRewRatePerTime * 0.9;
        console.log("first token manual caunted reward without penalty", firstTokenReward * tokenbits);
        let firstTokenRewWithPenalty = firstTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("first token manual caunted reward with penalty", firstTokenRewWithPenalty);

        let secondTokenReward = stakeAmount * (( afterOneDay - stakeStartTime ) / totalStaked) * secondRewRatePerTime * 0.9;
        console.log("second token manual caunted reward without penalty", secondTokenReward * tokenbits);
        let secondTokenRewWithPenalty = secondTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("second token manual caunted reward with penalty", secondTokenRewWithPenalty);

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        let firstTokenBalance = Number(await firstToken.balanceOf.call(firstAddr, { from: firstAddr })) / tokenbits;
        let secondTokenBalance = Number(await secondToken.balanceOf.call(firstAddr, { from: firstAddr })) / tokenbits;
        console.log("first token balance", firstTokenBalance);
        console.log("second token balance", secondTokenBalance);
        console.log("----------");

        assert.equal(((Number(stakeRew[0]) * 0.9) / tokenbits).toFixed(2), firstTokenBalance.toFixed(2),
         "getStakeRewards is wrong")
        assert.equal(((Number(stakeRew[1]) * 0.9) / tokenbits).toFixed(2), secondTokenBalance.toFixed(2),
         "getStakeRewards is wrong")

        assert.equal(firstTokenBalance.toFixed(2), firstTokenRewWithPenalty.toFixed(2), "first token balance is wrong");
        assert.equal(secondTokenBalance.toFixed(2), secondTokenRewWithPenalty.toFixed(2), "first token balance is wrong");
    })

    it("second user makes claim after stake with ref in 23 days", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let daysPassed = 23; 
        await time.increase(time.duration.days(daysPassed - 1)); // -1 day from previous test

        let stakeDetails = await bRingFarming.viewStakingDetails(secondAddr, { from: secondAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(secondAddr, stakeId, true, { from: secondAddr });

        console.log("---- 2nd user ----");
        console.log("getStakeRewards firstToken:", (Number(stakeRew[0]) * 0.94) / tokenbits);
        console.log("getStakeRewards secondToken:", (Number(stakeRew[1]) * 0.94) / tokenbits);

        let userStakingDetails = await bRingFarming.viewStakingDetails(secondAddr, { from: secondAddr });
        let stakeStartTime = Number(userStakingDetails[3][0]);

        let poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        let totalStaked = Number(poolData.totalStaked);
        let firstRewRatePerTime = 0.001;
        let secondRewRatePerTime = 0.002;

        let penaltyInfo = await bRingFarming.getPoolPenaltyInfo(firstTokenAddress, { from: secondAddr });
        let penaltyPercent = penaltyInfo.penaltyPercent;

        let afterSeventeenDays = stakeStartTime + (daysPassed * 24 * 3600);

        let firstTokenReward = stakeAmount * (( afterSeventeenDays - stakeStartTime ) / totalStaked) * firstRewRatePerTime * 0.94;
        console.log("first token manual caunted reward without penalty", firstTokenReward * tokenbits);
        let firstTokenRewWithPenalty = firstTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("first token manual caunted reward with penalty", firstTokenRewWithPenalty);

        let secondTokenReward = stakeAmount * (( afterSeventeenDays - stakeStartTime ) / totalStaked) * secondRewRatePerTime * 0.94;
        console.log("second token manual caunted reward without penalty", secondTokenReward * tokenbits);
        let secondTokenRewWithPenalty = secondTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("second token manual caunted reward with penalty", secondTokenRewWithPenalty);

        await bRingFarming.claimReward(stakeId, { from: secondAddr });

        let firstTokenBalance = Number(await firstToken.balanceOf.call(secondAddr, { from: secondAddr })) / tokenbits;
        let secondTokenBalance = Number(await secondToken.balanceOf.call(secondAddr, { from: secondAddr })) / tokenbits;
        console.log("first token balance", firstTokenBalance);
        console.log("second token balance", secondTokenBalance);
        console.log("----------");

        assert.equal(((Number(stakeRew[0]) * 0.94) / tokenbits).toFixed(2), firstTokenBalance.toFixed(2),
         "getStakeRewards is wrong")
        assert.equal(((Number(stakeRew[1]) * 0.94) / tokenbits).toFixed(2), secondTokenBalance.toFixed(2),
         "getStakeRewards is wrong")

        assert.equal(firstTokenBalance.toFixed(2), firstTokenRewWithPenalty.toFixed(2), "first token balance is wrong");
        assert.equal(secondTokenBalance.toFixed(2), secondTokenRewWithPenalty.toFixed(2), "first token balance is wrong");
    })

    it("third user makes claim after stake without ref in 44 days", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let daysPassed = 44;
        await time.increase(time.duration.days(daysPassed - 23)); // -23 days from previous tests

        let stakeDetails = await bRingFarming.viewStakingDetails(thirdAddr, { from: thirdAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(thirdAddr, stakeId, true, { from: thirdAddr });

        console.log("---- 3rd user ----");
        console.log("getStakeRewards firstToken:", (Number(stakeRew[0]) * 0.9) / tokenbits);
        console.log("getStakeRewards secondToken:", (Number(stakeRew[1]) * 0.9) / tokenbits);

        let userStakingDetails = await bRingFarming.viewStakingDetails(thirdAddr, { from: thirdAddr });
        let stakeStartTime = Number(userStakingDetails[3][0]);

        let poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        let totalStaked = Number(poolData.totalStaked);
        let firstRewRatePerTime = 0.001;
        let secondRewRatePerTime = 0.002;

        let penaltyInfo = await bRingFarming.getPoolPenaltyInfo(firstTokenAddress, { from: thirdAddr });
        let penaltyPercent = penaltyInfo.penaltyPercent;

        let afterFourtyFourDays = stakeStartTime + (daysPassed * 24 * 3600);

        let firstTokenReward = stakeAmount * (( afterFourtyFourDays - stakeStartTime ) / totalStaked) * firstRewRatePerTime * 0.9;
        console.log("first token manual caunted reward without penalty", firstTokenReward * tokenbits);
        let firstTokenRewWithPenalty = firstTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("first token manual caunted reward with penalty", firstTokenRewWithPenalty);

        let secondTokenReward = stakeAmount * (( afterFourtyFourDays - stakeStartTime ) / totalStaked) * secondRewRatePerTime * 0.9;
        console.log("second token manual caunted reward without penalty", secondTokenReward * tokenbits);
        let secondTokenRewWithPenalty = secondTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("second token manual caunted reward with penalty", secondTokenRewWithPenalty);

        await bRingFarming.claimReward(stakeId, { from: thirdAddr });

        let firstTokenBalance = Number(await firstToken.balanceOf.call(thirdAddr, { from: thirdAddr })) / tokenbits;
        let secondTokenBalance = Number(await secondToken.balanceOf.call(thirdAddr, { from: thirdAddr })) / tokenbits;
        console.log("first token balance", firstTokenBalance);
        console.log("second token balance", secondTokenBalance);
        console.log("----------");

        assert.equal(((Number(stakeRew[0]) * 0.9) / tokenbits).toFixed(2), firstTokenBalance.toFixed(2),
         "getStakeRewards is wrong")
        assert.equal(((Number(stakeRew[1]) * 0.9) / tokenbits).toFixed(2), secondTokenBalance.toFixed(2),
         "getStakeRewards is wrong")

        assert.equal(firstTokenBalance.toFixed(2), firstTokenRewWithPenalty.toFixed(2), "first token balance is wrong");
        assert.equal(secondTokenBalance.toFixed(2), secondTokenRewWithPenalty.toFixed(2), "first token balance is wrong");
    })

    it("fourth user makes claim after stake without ref in 45 days", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let daysPassed = 45;
        await time.increase(time.duration.days(daysPassed - 44)); // -44 days from previous tests

        let stakeDetails = await bRingFarming.viewStakingDetails(fourthAddr, { from: fourthAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(fourthAddr, stakeId, true, { from: fourthAddr });

        console.log("---- 4th user ----");
        console.log("getStakeRewards firstToken:", (Number(stakeRew[0]) * 0.9) / tokenbits);
        console.log("getStakeRewards secondToken:", (Number(stakeRew[1]) * 0.9) / tokenbits);

        let userStakingDetails = await bRingFarming.viewStakingDetails(fourthAddr, { from: fourthAddr });
        let stakeStartTime = Number(userStakingDetails[3][0]);

        let poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        let totalStaked = Number(poolData.totalStaked);
        let firstRewRatePerTime = 0.001;
        let secondRewRatePerTime = 0.002;

        let penaltyInfo = await bRingFarming.getPoolPenaltyInfo(firstTokenAddress, { from: fourthAddr });
        let penaltyPercent = penaltyInfo.penaltyPercent;

        let afterFourtyFiveDays = stakeStartTime + (daysPassed * 24 * 3600);

        let firstTokenReward = stakeAmount * (( afterFourtyFiveDays - stakeStartTime ) / totalStaked) * firstRewRatePerTime * 0.9;
        console.log("first token manual caunted reward without penalty", firstTokenReward * tokenbits);
        let firstTokenRewWithPenalty = firstTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("first token manual caunted reward with penalty", firstTokenRewWithPenalty);

        let secondTokenReward = stakeAmount * (( afterFourtyFiveDays - stakeStartTime ) / totalStaked) * secondRewRatePerTime * 0.9;
        console.log("second token manual caunted reward without penalty", secondTokenReward * tokenbits);
        let secondTokenRewWithPenalty = secondTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("second token manual caunted reward with penalty", secondTokenRewWithPenalty);

        await bRingFarming.claimReward(stakeId, { from: fourthAddr });

        let firstTokenBalance = Number(await firstToken.balanceOf.call(fourthAddr, { from: fourthAddr })) / tokenbits;
        let secondTokenBalance = Number(await secondToken.balanceOf.call(fourthAddr, { from: fourthAddr })) / tokenbits;
        console.log("first token balance", firstTokenBalance);
        console.log("second token balance", secondTokenBalance);
        console.log("----------");

        assert.equal(firstTokenBalance.toFixed(2), (firstTokenReward  * tokenbits).toFixed(2), "first token balance is wrong");
        assert.equal(secondTokenBalance.toFixed(2), (secondTokenReward * tokenbits).toFixed(2), "first token balance is wrong");
    })

    it("fifth user makes unstake after stake without ref in 90 days", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let daysPassed = 90;
        await time.increase(time.duration.days(daysPassed - 45)); // -45 days from previous tests

        let stakeDetails = await bRingFarming.viewStakingDetails(fifthAddr, { from: fifthAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(fifthAddr, stakeId, true, { from: fifthAddr });

        console.log("---- 5th user ----");
        console.log("getStakeRewards firstToken:", (Number(stakeRew[0]) * 0.9) / tokenbits);
        console.log("getStakeRewards secondToken:", (Number(stakeRew[1]) * 0.9) / tokenbits);

        let userStakingDetails = await bRingFarming.viewStakingDetails(fifthAddr, { from: fifthAddr });
        let stakeStartTime = Number(userStakingDetails[3][0]);

        let poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        let totalStaked = Number(poolData.totalStaked);
        let firstRewRatePerTime = 0.001;
        let secondRewRatePerTime = 0.002;

        let penaltyInfo = await bRingFarming.getPoolPenaltyInfo(firstTokenAddress, { from: fifthAddr });
        let penaltyPercent = penaltyInfo.penaltyPercent;

        const contractDeplTime = Number(await bRingFarming.contractDeploymentTime({ from: deployer }));
        const stakingDuration = Number(await bRingFarming.stakingDuration({ from: deployer }));
        let poolEndTime = contractDeplTime + stakingDuration;

        let firstTokenReward = stakeAmount * (( poolEndTime - stakeStartTime ) / totalStaked) * firstRewRatePerTime * 0.9;
        console.log("first token manual caunted reward without penalty", firstTokenReward * tokenbits);
        let firstTokenRewWithPenalty = firstTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("first token manual caunted reward with penalty", firstTokenRewWithPenalty);

        let secondTokenReward = stakeAmount * (( poolEndTime - stakeStartTime ) / totalStaked) * secondRewRatePerTime * 0.9;
        console.log("second token manual caunted reward without penalty", secondTokenReward * tokenbits);
        let secondTokenRewWithPenalty = secondTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("second token manual caunted reward with penalty", secondTokenRewWithPenalty);

        await bRingFarming.unstake(stakeId, { from: fifthAddr });  

        let firstTokenBalance = Number(await firstToken.balanceOf.call(fifthAddr, { from: fifthAddr })) / tokenbits;
        let secondTokenBalance = Number(await secondToken.balanceOf.call(fifthAddr, { from: fifthAddr })) / tokenbits;
        console.log("first token balance", firstTokenBalance);
        console.log("second token balance", secondTokenBalance);
        console.log("----------");

        assert.equal(((Number(stakeRew[0]) * 0.9) / tokenbits).toFixed(2), (firstTokenBalance - stakeAmount).toFixed(2),
         "getStakeRewards is wrong")
        assert.equal(((Number(stakeRew[1]) * 0.9) / tokenbits).toFixed(2), secondTokenBalance.toFixed(2),
         "getStakeRewards is wrong")

        assert.equal((firstTokenBalance - stakeAmount).toFixed(2), (firstTokenReward  * tokenbits).toFixed(2), "first token balance is wrong");
        assert.equal(secondTokenBalance.toFixed(2), (secondTokenReward * tokenbits).toFixed(2), "first token balance is wrong");
    })
})