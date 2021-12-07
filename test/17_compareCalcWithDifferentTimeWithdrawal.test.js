const FirstToken = artifacts.require("FirstToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    time,
    constants
} = require('@openzeppelin/test-helpers');

describe("compare calculations with the withdrawal of one user stake at the middle of period", () => {
    contract("user makes unstake", async accounts => {
        const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr ] = accounts;
    
        let bRingFarming;
        let bRingFarmingAddress;
    
        let firstToken;
        let firstTokenAddress;
    
        let minStakeAmount = 1;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 1000000; // 1 000 000
    
        let stakeAmount = 10000;
    
        before(async () => {
            // tokens deployed
            firstToken = await FirstToken.new({ from: deployer });
            firstTokenAddress = firstToken.address;
    
            // contract deployed
            bRingFarming = await bRingFarmingContract.new({ from: deployer });
            bRingFarmingAddress = bRingFarming.address;
        })
    
        it("config Pool", async () => {
            const decimals = await firstToken.decimals();
            const tokenbits = (new BN(10)).pow(decimals);
            let tokenRewards = [1];
            const rewardsTokenbits = (new BN(10)).pow(new BN(15));

            const maxPenalty = new BN(0);
            const penaltyDuration = 45 * 24 * 3600;
    
            await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
                (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
                [firstTokenAddress], 
                [(new BN(tokenRewards[0])).mul(rewardsTokenbits)],
                maxPenalty, penaltyDuration, deployer,
                constants.ZERO_ADDRESS,
                0)
        })
    
        it("send tokens to the contract address", async () => {
            let tokenContractBalance;
            let tokensNames = [firstToken];
    
            const firstTokenDecimals = await firstToken.decimals();
            const decimals = [firstTokenDecimals];
    
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
    
        it("users make stakes without referrer at an hourly interval", async () => {
            const decimals = await firstToken.decimals();
            const tokenbits = (new BN(10)).pow(decimals);
    
            let users = [firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr];
            let stakeDetails;
    
            for(let i = 0; i < users.length; i++) {
                await time.increase(time.duration.hours(1));
                
                await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
                await bRingFarming.methods['stake(address,address,uint256)'](users[i], firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
    
                stakeDetails = await bRingFarming.viewStakingDetails(users[i], 0, 0, { from: users[i] });
    
                assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
                assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
                // console.log("----");
                // console.log(Number(stakeDetails[3]));
                // console.log("----");
            }
        })

        it("one user makes unstake after 45 days", async () => {
            // const decimals = await firstToken.decimals();
            // const tokenbits = (new BN(10)).pow(decimals);

            let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, 0, 0, { from: firstAddr });
            let stakeId = stakeDetails[0][0];

            await bRingFarming.unstake(stakeId, { from: firstAddr });
        })
    
        // it("users make unstakes after 90 days", async () => {
        //     const decimals = await firstToken.decimals();
        //     const tokenbits = (new BN(10)).pow(decimals);
    
        //     let users = [secondAddr, thirdAddr, fourthAddr, fifthAddr];
        //     let stakeDetails, stakeId;
        //     let userBalance;
    
        //     await time.increase(time.duration.days(90));
    
        //     const contractDeplTime = Number(await bRingFarming.contractDeploymentTime({ from: deployer }));
        //     const stakingDuration = Number(await bRingFarming.stakingDuration({ from: deployer }));
        //     let poolEndTime = contractDeplTime + stakingDuration;
    
        //     let userStakingDetails, stakeStartTime;
        //     let poolData, totalStaked, rewardWithoutMultiplier;
        //     let rewardRatePerTime = 0.001;
        //     const maxMultiplier = Number(await bRingFarming.stakeMultiplier());
    
        //     let daysPassedBeforeStake, stakingTime, multiplier;
        //     // let stakeRew;
    
        //     for(let i = 0; i < users.length; i++) {
        //         userStakingDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });
        //         stakeStartTime = Number(userStakingDetails[3][0]);
    
        //         poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        //         totalStaked = Number(poolData.totalStaked);
        //         rewardWithoutMultiplier = stakeAmount * (( poolEndTime - stakeStartTime ) / totalStaked) * rewardRatePerTime;
    
        //         daysPassedBeforeStake = Math.floor((stakeStartTime - contractDeplTime) / 3600 / 24);
        //         stakingTime = poolEndTime - (contractDeplTime + (daysPassedBeforeStake * 24 * 3600));
    
        //         multiplier = 1 + ((maxMultiplier - 1) * stakingTime) / stakingDuration;
    
        //         console.log(`-- ${i+2} user --`);
        //         console.log("ui calc", (rewardWithoutMultiplier * multiplier / 2 * 0.9) * tokenbits);
        //         console.log("--------");
        //     }
    
        //     for(let i = 0; i < users.length; i++) {
        //         stakeDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });
        //         stakeId = stakeDetails[0][0];
    
        //         // stakeRew = await bRingFarming.getStakeRewards(users[i], stakeId, { from: users[i] });
            
        //         // console.log("contract", (Number(stakeRew[0]) * 0.9) / tokenbits);
        //         // console.log("--------");
    
        //         await bRingFarming.unstake(stakeId, { from: users[i] });
        //         userBalance = Number(await firstToken.balanceOf(users[i], { from: users[i] })) / tokenbits;
    
        //         console.log(`-- ${i+2} user --`);
        //         console.log("balance: ", userBalance - stakeAmount);
        //         console.log("--------");
        //     }
        // })
    
    })

    contract("user makes claim", async accounts => {
        const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr ] = accounts;
    
        let bRingFarming;
        let bRingFarmingAddress;
    
        let firstToken;
        let firstTokenAddress;
    
        let minStakeAmount = 1;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 1000000; // 1 000 000
    
        let stakeAmount = 10000;
    
        before(async () => {
            // tokens deployed
            firstToken = await FirstToken.new({ from: deployer });
            firstTokenAddress = firstToken.address;
    
            // contract deployed
            bRingFarming = await bRingFarmingContract.new({ from: deployer });
            bRingFarmingAddress = bRingFarming.address;
        })
    
        it("config Pool", async () => {
            const decimals = await firstToken.decimals();
            const tokenbits = (new BN(10)).pow(decimals);
            let tokenRewards = [1];
            const rewardsTokenbits = (new BN(10)).pow(new BN(15));

            const maxPenalty = new BN(0);
            const penaltyDuration = 45 * 24 * 3600;
    
            await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
                (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
                [firstTokenAddress], 
                [(new BN(tokenRewards[0])).mul(rewardsTokenbits)],
                maxPenalty, penaltyDuration, deployer,
                constants.ZERO_ADDRESS,
                0)
        })
    
        it("send tokens to the contract address", async () => {
            let tokenContractBalance;
            let tokensNames = [firstToken];
    
            const firstTokenDecimals = await firstToken.decimals();
            const decimals = [firstTokenDecimals];
    
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
    
        it("users make stakes without referrer at an hourly interval", async () => {
            const decimals = await firstToken.decimals();
            const tokenbits = (new BN(10)).pow(decimals);
    
            let users = [firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr];
            let stakeDetails;
    
            for(let i = 0; i < users.length; i++) {
                await time.increase(time.duration.hours(1));
                
                await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
                await bRingFarming.methods['stake(address,address,uint256)'](users[i], firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
    
                stakeDetails = await bRingFarming.viewStakingDetails(users[i], 0, 0, { from: users[i] });
    
                assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
                assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
                // console.log("----");
                // console.log(Number(stakeDetails[3]));
                // console.log("----");
            }
        })

        it("one user makes claim after 45 days", async () => {
            // const decimals = await firstToken.decimals();
            // const tokenbits = (new BN(10)).pow(decimals);

            let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, 0, 0, { from: firstAddr });
            let stakeId = stakeDetails[0][0];

            await bRingFarming.claimReward(stakeId, { from: firstAddr });
        })
    
        // it("users make unstakes after 90 days", async () => {
        //     const decimals = await firstToken.decimals();
        //     const tokenbits = (new BN(10)).pow(decimals);
    
        //     let users = [firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr];
        //     let stakeDetails, stakeId;
        //     let userBalance;
    
        //     await time.increase(time.duration.days(90));
    
        //     const contractDeplTime = Number(await bRingFarming.contractDeploymentTime({ from: deployer }));
        //     const stakingDuration = Number(await bRingFarming.stakingDuration({ from: deployer }));
        //     let poolEndTime = contractDeplTime + stakingDuration;
    
        //     let userStakingDetails, stakeStartTime;
        //     let poolData, totalStaked, rewardWithoutMultiplier;
        //     let rewardRatePerTime = 0.001;
        //     const maxMultiplier = Number(await bRingFarming.stakeMultiplier());
    
        //     let daysPassedBeforeStake, stakingTime, multiplier;
        //     // let stakeRew;
    
        //     for(let i = 0; i < users.length; i++) {
        //         userStakingDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });
        //         stakeStartTime = Number(userStakingDetails[3][0]);
    
        //         poolData = await bRingFarming.pools(firstTokenAddress, { from: deployer });
        //         totalStaked = Number(poolData.totalStaked);
        //         rewardWithoutMultiplier = stakeAmount * (( poolEndTime - stakeStartTime ) / totalStaked) * rewardRatePerTime;
    
        //         daysPassedBeforeStake = Math.floor((stakeStartTime - contractDeplTime) / 3600 / 24);
        //         stakingTime = poolEndTime - (contractDeplTime + (daysPassedBeforeStake * 24 * 3600));
    
        //         multiplier = 1 + ((maxMultiplier - 1) * stakingTime) / stakingDuration;
    
        //         console.log(`-- ${i+1} user --`);
        //         console.log("ui calc", (rewardWithoutMultiplier * multiplier / 2 * 0.9) * tokenbits);
        //         console.log("--------");
        //     }
    
        //     for(let i = 0; i < users.length; i++) {
        //         stakeDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });
        //         stakeId = stakeDetails[0][0];
    
        //         // stakeRew = await bRingFarming.getStakeRewards(users[i], stakeId, { from: users[i] });
            
        //         // console.log("contract", (Number(stakeRew[0]) * 0.9) / tokenbits);
        //         // console.log("--------");
    
        //         await bRingFarming.unstake(stakeId, { from: users[i] });
        //         userBalance = Number(await firstToken.balanceOf(users[i], { from: users[i] })) / tokenbits;
    
        //         console.log(`-- ${i+1} user --`);
        //         console.log("balance: ", userBalance - stakeAmount);
        //         console.log("--------");
        //     }
        // })
    
    })
})
