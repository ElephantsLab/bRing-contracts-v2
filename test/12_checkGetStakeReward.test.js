const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    time,
    constants
} = require('@openzeppelin/test-helpers');

contract("check expected reward", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, thirdToken;
    let firstTokenAddress, secondTokenAddress, thirdTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000

    let oneHundred = 100;
    let oneThousand = 1000;
    let tenThousand = 10000;
    let oneHundredThousand = 100000;

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
        let tokenRewards = [277, 277, 277];
        const rewardsTokenbits = (new BN(10)).pow(new BN(12));

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
    })

    it("send tokens to the contract address", async () => {
        let tokenContractBalance;
        let tokensNames = [firstToken, secondToken, thirdToken];

        const firstTokenDecimals = await firstToken.decimals();
        const secondTokenDecimals = await secondToken.decimals();
        const thirdTokenDecimals = await thirdToken.decimals();
        const decimals = [firstTokenDecimals, secondTokenDecimals, thirdTokenDecimals];

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
            await firstToken.transfer(users[i], (new BN(maxStakeAmount)).mul(tokenbits), { from: deployer });
            userBalance = await firstToken.balanceOf.call(users[i]);
            assert.equal(userBalance.valueOf(), Number((new BN(maxStakeAmount)).mul(tokenbits)), `${users[i]} user tokens balance is wrong`);
        }
    })

    it("firstAddr user makes STAKE without referrer", async () => {
        await time.increase(time.duration.hours(1));
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(oneThousand)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(oneThousand)).mul(tokenbits), { from: firstAddr });
    })

    it("firstAddr user makes 2nd STAKE without referrer", async () => {
        await time.increase(time.duration.minutes(1));
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(oneHundred)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(oneHundred)).mul(tokenbits), { from: firstAddr });
    })

    // it("firstAddr user makes UNSTAKE", async () => {
    //     await time.increase(time.duration.minutes(10));

    //     let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
    //     let stakeId = stakeDetails[0][0];

    //     await bRingFarming.unstake(stakeId, { from: firstAddr });
    // })

    // it("firstAddr user makes 2nd UNSTAKE", async () => {
    //     await time.increase(time.duration.minutes(1));

    //     let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
    //     let stakeId = stakeDetails[0][1];

    //     await bRingFarming.unstake(stakeId, { from: firstAddr });
    // })

    it("users make STAKE with referrer", async () => {
        await time.increase(time.duration.minutes(30));
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let users = [secondAddr, thirdAddr, fourthAddr];

        for(let i = 0; i < users.length; i++){
            await firstToken.approve(bRingFarmingAddress, (new BN(oneHundredThousand)).mul(tokenbits), { from: users[i] });
            await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(oneHundredThousand)).mul(tokenbits), { from: users[i] });
        }        
    })

    it("thirdAddr user make UNSTAKE", async () => {
        await time.increase(time.duration.hours(1));

        let stakeDetails = await bRingFarming.viewStakingDetails(thirdAddr, { from: thirdAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.unstake(stakeId, { from: thirdAddr });
    })

    // it("firstAddr user makes UNSTAKE", async () => {
    //     await time.increase(time.duration.minutes(10));

    //     let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
    //     let stakeId = stakeDetails[0][0];

    //     await bRingFarming.unstake(stakeId, { from: firstAddr });
    // })

    it("fifthAddr user makes STAKE without referrer", async () => {
        await time.increase(time.duration.hours(1));
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(tenThousand)).mul(tokenbits), { from: fifthAddr });
        await bRingFarming.stake(fifthAddr, firstTokenAddress, (new BN(tenThousand)).mul(tokenbits), { from: fifthAddr });
    })

    // it("firstAddr 1st Stake difference ui vs contract", async () => {
    //     await time.increase(time.duration.days(90));
    //     const decimals = await firstToken.decimals();
    //     const tokenbits = (new BN(10)).pow(decimals);

    //     const contractDeplTime = Number(await bRingFarming.contractDeploymentTime({ from: deployer }));
    //     const stakingDuration = Number(await bRingFarming.stakingDuration({ from: deployer }));
    //     let poolEndTime = contractDeplTime + stakingDuration;

    //     let firstUserStakingDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
    //     let stakeStartTime = Number(firstUserStakingDetails[3][0]);

    //     let poolData = await bRingFarming.pools(firstTokenAddress);
    //     let totalStaked = Number(poolData.totalStaked);
    //     let rewardRatePerTime = 0.000277;
    //     let rewardWithoutMultiplier = (oneThousand * ( poolEndTime - stakeStartTime ) / totalStaked * rewardRatePerTime);

    //     const maxMultiplier = Number(await bRingFarming.stakeMultiplier());
    //     const daysPassedBeforeStake = Math.floor((stakeStartTime - contractDeplTime) / 3600 / 24);
    //     const stakingTime = poolEndTime - (contractDeplTime + (daysPassedBeforeStake * 24 * 3600));
        
    //     let multiplier = 1 + (maxMultiplier - 1) * stakingTime / stakingDuration;

    //     console.log('firstAddr 1st Stake');
    //     console.log("ui", (rewardWithoutMultiplier * multiplier * 0.9) * tokenbits);

    //     let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
    //     let stakeId = stakeDetails[0][0];

    //     let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId, { from: firstAddr });
        
    //     console.log("contract", (Number(stakeRew[0]) * 0.9) / tokenbits);
    // })

    // it("firstAddr 2nd Stake difference ui vs contract", async () => {
    //     await time.increase(time.duration.days(90));
    //     const decimals = await firstToken.decimals();
    //     const tokenbits = (new BN(10)).pow(decimals);

    //     const contractDeplTime = Number(await bRingFarming.contractDeploymentTime({ from: deployer }));
    //     const stakingDuration = Number(await bRingFarming.stakingDuration({ from: deployer }));
    //     let poolEndTime = contractDeplTime + stakingDuration;

    //     let firstUserStakingDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
    //     let stakeStartTime = Number(firstUserStakingDetails[3][1]);

    //     let poolData = await bRingFarming.pools(firstTokenAddress);
    //     let totalStaked = Number(poolData.totalStaked);
    //     let rewardRatePerTime = 0.000277;
    //     let rewardWithoutMultiplier = (oneHundred * ( poolEndTime - stakeStartTime ) / totalStaked * rewardRatePerTime);

    //     const maxMultiplier = Number(await bRingFarming.stakeMultiplier());
    //     const daysPassedBeforeStake = Math.floor((stakeStartTime - contractDeplTime) / 3600 / 24);
    //     const stakingTime = poolEndTime - (contractDeplTime + (daysPassedBeforeStake * 24 * 3600));
        
    //     let multiplier = 1 + (maxMultiplier - 1) * stakingTime / stakingDuration;

    //     console.log('firstAddr 2nd Stake');
    //     console.log("ui", (rewardWithoutMultiplier * multiplier * 0.9) * tokenbits);

    //     let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
    //     let stakeId = stakeDetails[0][1];

    //     let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId, { from: firstAddr });
        
    //     console.log("contract", (Number(stakeRew[0]) * 0.9) / tokenbits);
    // })

    // it("secondAddr difference ui vs contract", async () => {
    //     await time.increase(time.duration.days(90));
    //     const decimals = await firstToken.decimals();
    //     const tokenbits = (new BN(10)).pow(decimals);

    //     const contractDeplTime = Number(await bRingFarming.contractDeploymentTime({ from: deployer }));
    //     const stakingDuration = Number(await bRingFarming.stakingDuration({ from: deployer }));
    //     let poolEndTime = contractDeplTime + stakingDuration;

    //     let firstUserStakingDetails = await bRingFarming.viewStakingDetails(secondAddr, { from: secondAddr });
    //     let stakeStartTime = Number(firstUserStakingDetails[3][0]);

    //     let poolData = await bRingFarming.pools(firstTokenAddress);
    //     let totalStaked = Number(poolData.totalStaked);
    //     let rewardRatePerTime = 0.000277;
    //     let rewardWithoutMultiplier = oneHundredThousand * (( poolEndTime - stakeStartTime ) / totalStaked) * rewardRatePerTime;

    //     const maxMultiplier = Number(await bRingFarming.stakeMultiplier());
    //     const daysPassedBeforeStake = Math.floor((stakeStartTime - contractDeplTime) / 3600 / 24);
    //     const stakingTime = poolEndTime - (contractDeplTime + (daysPassedBeforeStake * 24 * 3600));
        
    //     let multiplier = 1 + ((maxMultiplier - 1) * stakingTime) / stakingDuration;

    //     console.log('secondAddr');
    //     console.log("ui", (rewardWithoutMultiplier * multiplier * 0.94) * tokenbits);

    //     let stakeDetails = await bRingFarming.viewStakingDetails(secondAddr, { from: secondAddr });
    //     let stakeId = stakeDetails[0][0];

    //     let stakeRew = await bRingFarming.getStakeRewards(secondAddr, stakeId, { from: secondAddr });
        
    //     console.log("contract", (Number(stakeRew[0]) * 0.94) / tokenbits);
    // })

    // it("fifthAddr difference ui vs contract", async () => {
    //     await time.increase(time.duration.days(90));
    //     const decimals = await firstToken.decimals();
    //     const tokenbits = (new BN(10)).pow(decimals);

    //     const contractDeplTime = Number(await bRingFarming.contractDeploymentTime({ from: deployer }));
    //     const stakingDuration = Number(await bRingFarming.stakingDuration({ from: deployer }));
    //     let poolEndTime = contractDeplTime + stakingDuration;

    //     let firstUserStakingDetails = await bRingFarming.viewStakingDetails(fifthAddr, { from: fifthAddr });
    //     let stakeStartTime = Number(firstUserStakingDetails[3][0]);

    //     let poolData = await bRingFarming.pools(firstTokenAddress);
    //     let totalStaked = Number(poolData.totalStaked);
    //     let rewardRatePerTime = 0.000277;
    //     let rewardWithoutMultiplier = tenThousand * (( poolEndTime - stakeStartTime ) / totalStaked) * rewardRatePerTime;

    //     const maxMultiplier = Number(await bRingFarming.stakeMultiplier());
    //     const daysPassedBeforeStake = Math.floor((stakeStartTime - contractDeplTime) / 3600 / 24);
    //     const stakingTime = poolEndTime - (contractDeplTime + (daysPassedBeforeStake * 24 * 3600));
        
    //     let multiplier = 1 + ((maxMultiplier - 1) * stakingTime) / stakingDuration;

    //     console.log('fifthAddr');
    //     console.log("ui", (rewardWithoutMultiplier * multiplier * 0.9) * tokenbits);

    //     let stakeDetails = await bRingFarming.viewStakingDetails(fifthAddr, { from: fifthAddr });
    //     let stakeId = stakeDetails[0][0];

    //     let stakeRew = await bRingFarming.getStakeRewards(fifthAddr, stakeId, { from: fifthAddr });
        
    //     console.log("contract", (Number(stakeRew[0]) * 0.9) / tokenbits);
    // })
})