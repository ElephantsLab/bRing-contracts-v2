const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    time,
    constants
} = require('@openzeppelin/test-helpers');

contract("check rewardRates for overflow", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, thirdToken;
    let firstTokenAddress, secondTokenAddress, thirdTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 10000000000; // 10 000 000 000

    let stakeAmount = 10000;

    let firstNumTokenRew = 100000000;
    let secondNumTokenRew = 100;
    let thirdNumTokenRew = 1;

    before(async () => {
        // tokens deployed
        firstToken = await FirstToken.new({ from: deployer });
        firstTokenAddress = firstToken.address;

        secondToken = await SecondToken.new({ from: deployer });
        secondTokenAddress = secondToken.address;

        thirdToken = await ThirdToken.new({ from: deployer });
        thirdTokenAddress = thirdToken.address;

        // contract deployed
        bRingFarming = await bRingFarmingContract.new({ from: deployer });
        bRingFarmingAddress = bRingFarming.address;
    })

    it("config Pool", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        let tokenRewards = [firstNumTokenRew, secondNumTokenRew, thirdNumTokenRew];
        const rewardsTokenbits = (new BN(10)).pow(new BN(18));

        const maxPenalty = new BN(0);
        const penaltyDuration = 45 * 24 * 3600;

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[2])).mul(rewardsTokenbits)
            ],
            maxPenalty, penaltyDuration, deployer,
            constants.ZERO_ADDRESS,
            0)
    });

    it("send tokens to the contract address", async () => {
        let tokenContractBalance;
        let tokensNames = [firstToken, secondToken, thirdToken];

        const firstTokenDecimals = await firstToken.decimals();
        const secondTokenDecimals = await secondToken.decimals();
        const thirdTokenDecimals = await thirdToken.decimals();
        const decimals = [firstTokenDecimals, secondTokenDecimals, thirdTokenDecimals];

        for(let i = 0; i < tokensNames.length; i++){
            let tokenbits = (new BN(10)).pow(decimals[i]);
            await tokensNames[i].transfer(bRingFarmingAddress, (new BN((totalStakeLimit * 100000))).mul(tokenbits), { from: deployer });
            tokenContractBalance = await tokensNames[i].balanceOf.call(bRingFarmingAddress);
            assert.equal(tokenContractBalance.valueOf(), Number((new BN((totalStakeLimit * 100000))).mul(tokenbits)), `contract ${tokensNames[i]} balance is wrong`);
        }
    });

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
    });

    it("users make stakes without referrer", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let users = [firstAddr, thirdAddr, fourthAddr, fifthAddr];
        let stakeDetails;

        for(let i = 0; i < users.length; i++) {          
            await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
            await bRingFarming.methods['stake(address,address,uint256)'](users[i], firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });

            stakeDetails = await bRingFarming.viewStakingDetails(users[i], 0, 0, { from: users[i] });

            assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
            assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
        }
    });

    it("second user makes stake with referrer", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: secondAddr });
        await bRingFarming.methods['stake(address,address,uint256)'](firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: secondAddr });

        let stakeDetails = await bRingFarming.viewStakingDetails(secondAddr, 0, 0, { from: secondAddr });

        assert.equal(stakeDetails[0].length, 1, `user number of stake is wrong`);
        assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `user stake amount is wrong`);
    });

    it("first user makes claim after stake without ref in 1 day", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let daysPassed = 1;
        await time.increase(time.duration.days(daysPassed));

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, 0, 0, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId,  { from: firstAddr });

        console.log("---- 1st user ----");
        console.log("getStakeRewards firstToken:", (Number(stakeRew[0]) * 0.9) / tokenbits);
        console.log("getStakeRewards secondToken:", (Number(stakeRew[1]) * 0.9) / tokenbits);
        console.log("getStakeRewards thirdToken:", (Number(stakeRew[2]) * 0.9) / tokenbits);
        expect((Number(stakeRew[0]) * 0.9)).to.be.above(0);

        let userStakingDetails = await bRingFarming.viewStakingDetails(firstAddr, 0, 0, { from: firstAddr });
        let stakeStartTime = Number(userStakingDetails[3][0]);

        let poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        let totalStaked = Number(poolData.totalStaked);
        let firstRewRatePerTime = firstNumTokenRew;
        let secondRewRatePerTime = secondNumTokenRew;
        let thirdRewRatePerTime = thirdNumTokenRew;

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

        let thirdTokenReward = stakeAmount * (( afterOneDay - stakeStartTime ) / totalStaked) * thirdRewRatePerTime * 0.9;
        console.log("third token manual caunted reward without penalty", thirdTokenReward * tokenbits);
        let thirdTokenRewWithPenalty = thirdTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("third token manual caunted reward with penalty", thirdTokenRewWithPenalty);

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        let firstTokenBalance = Number(await firstToken.balanceOf.call(firstAddr, { from: firstAddr })) / tokenbits;
        let secondTokenBalance = Number(await secondToken.balanceOf.call(firstAddr, { from: firstAddr })) / tokenbits;
        let thirdTokenBalance = Number(await thirdToken.balanceOf.call(firstAddr, { from: firstAddr })) / tokenbits;
        console.log("first token balance", firstTokenBalance);
        console.log("second token balance", secondTokenBalance);
        console.log("third token balance", thirdTokenBalance);
        console.log("----------");

        assert.equal(((Number(stakeRew[0]) * 0.9) / tokenbits).toFixed(0), firstTokenBalance.toFixed(0),
         "getStakeRewards is wrong");
        assert.equal(((Number(stakeRew[1]) * 0.9) / tokenbits).toFixed(0), secondTokenBalance.toFixed(0),
         "getStakeRewards is wrong");
        assert.equal(((Number(stakeRew[2]) * 0.9) / tokenbits).toFixed(0), thirdTokenBalance.toFixed(0),
         "getStakeRewards is wrong");

        assert.equal(firstTokenBalance.toFixed(0), firstTokenRewWithPenalty.toFixed(0), "first token balance is wrong");
        assert.equal(secondTokenBalance.toFixed(0), secondTokenRewWithPenalty.toFixed(0), "second token balance is wrong");
        assert.equal(thirdTokenBalance.toFixed(0), thirdTokenRewWithPenalty.toFixed(0), "third token balance is wrong");
    });

    it("fifth user makes unstake after stake without ref in 90 days", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let daysPassed = 90;
        await time.increase(time.duration.days(daysPassed));

        let stakeDetails = await bRingFarming.viewStakingDetails(fifthAddr, 0, 0, { from: fifthAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(fifthAddr, stakeId, true, { from: fifthAddr });

        console.log("---- 5th user ----");
        console.log("getStakeRewards firstToken:", (Number(stakeRew[0]) * 0.9) / tokenbits);
        console.log("getStakeRewards secondToken:", (Number(stakeRew[1]) * 0.9) / tokenbits);
        console.log("getStakeRewards thirdToken:", (Number(stakeRew[2]) * 0.9) / tokenbits);

        let userStakingDetails = await bRingFarming.viewStakingDetails(fifthAddr, 0, 0, { from: fifthAddr });
        let stakeStartTime = Number(userStakingDetails[3][0]);

        let poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        let totalStaked = Number(poolData.totalStaked);
        let firstRewRatePerTime = firstNumTokenRew;
        let secondRewRatePerTime = secondNumTokenRew;
        let thirdRewRatePerTime = thirdNumTokenRew;

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

        let thirdTokenReward = stakeAmount * (( poolEndTime - stakeStartTime ) / totalStaked) * thirdRewRatePerTime * 0.9;
        console.log("third token manual caunted reward without penalty", thirdTokenReward * tokenbits);
        let thirdTokenRewWithPenalty = thirdTokenReward * (100 * (new BN(1)).mul((new BN(10)).pow(new BN(12))) 
            - penaltyPercent) / 100 / (new BN(1)).mul((new BN(10)).pow(new BN(12))) * tokenbits;
        console.log("third token manual caunted reward with penalty", thirdTokenRewWithPenalty);

        await bRingFarming.unstake(stakeId, { from: fifthAddr });  

        let firstTokenBalance = Number(await firstToken.balanceOf.call(fifthAddr, { from: fifthAddr })) / tokenbits;
        let secondTokenBalance = Number(await secondToken.balanceOf.call(fifthAddr, { from: fifthAddr })) / tokenbits;
        let thirdTokenBalance = Number(await thirdToken.balanceOf.call(fifthAddr, { from: fifthAddr })) / tokenbits;
        console.log("first token balance", firstTokenBalance);
        console.log("second token balance", secondTokenBalance);
        console.log("third token balance", thirdTokenBalance);
        console.log("----------");

        assert.equal(((Number(stakeRew[0]) * 0.9) / tokenbits).toFixed(2), (firstTokenBalance - stakeAmount).toFixed(2),
         "getStakeRewards is wrong");
        assert.equal(((Number(stakeRew[1]) * 0.9) / tokenbits).toFixed(2), secondTokenBalance.toFixed(2),
         "getStakeRewards is wrong");
        assert.equal(((Number(stakeRew[2]) * 0.9) / tokenbits).toFixed(2), thirdTokenBalance.toFixed(2),
         "getStakeRewards is wrong");

        assert.equal((firstTokenBalance - stakeAmount).toFixed(2), (firstTokenReward  * tokenbits).toFixed(2), "first token balance is wrong");
        assert.equal(secondTokenBalance.toFixed(2), (secondTokenReward * tokenbits).toFixed(2), "first token balance is wrong");
        assert.equal(thirdTokenBalance.toFixed(0), thirdTokenRewWithPenalty.toFixed(0), "third token balance is wrong");
    })
})