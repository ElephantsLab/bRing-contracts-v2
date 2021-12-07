const FirstToken = artifacts.require("FirstToken");

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

    let firstToken;
    let firstTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000 

    let stakeAmount = 10000;

    let fourtyFiveDaysReward;

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
        const maxPenalty = new BN(30);
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
    })

    it("send tokens to the contract address", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
       
        await firstToken.transfer(bRingFarmingAddress, (new BN(maxStakeAmount)).mul(tokenbits), { from: deployer });
        let tokenContractBalance = await firstToken.balanceOf.call(bRingFarmingAddress);
        assert.equal(tokenContractBalance.valueOf(), Number((new BN(maxStakeAmount)).mul(tokenbits)), `contract balance is wrong`);

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

        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr];
        let stakeDetails;

        for(let i = 0; i < users.length; i++) {          
            await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
            await bRingFarming.methods['stake(address,address,uint256)'](users[i], firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });

            stakeDetails = await bRingFarming.viewStakingDetails(users[i], 0, 0, { from: users[i] });

            assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
            assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
        }
    })

    it("four users should get the same reward in 1 day", async () => {
        await time.increase(time.duration.days(1));

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr];
        let stakeDetails, stakeId, stakeRew, stakeReward;
        for(let i = 0; i < users.length; i++) {
            stakeDetails = await bRingFarming.viewStakingDetails(users[i], 0, 0, { from: users[i] });
            stakeId = stakeDetails[0][0];

            stakeRew = await bRingFarming.getStakeRewards(users[i], stakeId, true, { from: users[i] });
            stakeReward = (Number(stakeRew[0]) * 0.9) / tokenbits;
            console.log(`getStakeRewards ${i+1} user:`, stakeReward);
        }       
    })

    it("four users should get the same reward in 44 day", async () => {
        await time.increase(time.duration.days(43)); // 44 - 1 from previous test

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr];
        let stakeDetails, stakeId, stakeRew, stakeReward;
        
        for(let i = 0; i < users.length; i++) {
            stakeDetails = await bRingFarming.viewStakingDetails(users[i], 0, 0, { from: users[i] });
            stakeId = stakeDetails[0][0];

            stakeRew = await bRingFarming.getStakeRewards(users[i], stakeId, true, { from: users[i] });
            stakeReward = (Number(stakeRew[0]) * 0.9) / tokenbits;
            console.log(`getStakeRewards ${i+1} user:`, stakeReward);
        }     
    })

    it("four users should get the same reward in 45 day", async () => {
        let daysPassed = 45;
        await time.increase(time.duration.days(daysPassed - 44)); // 45 - 44 from previous tests

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr];
        let stakeDetails, stakeId, stakeRew, stakeReward;
        
        for(let i = 0; i < users.length; i++) {
            stakeDetails = await bRingFarming.viewStakingDetails(users[i], 0, 0, { from: users[i] });
            stakeId = stakeDetails[0][0];

            stakeRew = await bRingFarming.getStakeRewards(users[i], stakeId, false, { from: users[i] });
            stakeReward = (Number(stakeRew[0]) * 0.9) / tokenbits;
            console.log(`getStakeRewards ${i+1} user:`, stakeReward);
        }
        fourtyFiveDaysReward = stakeReward.toFixed(2); 
    })

    it("user makes stake without referrer", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        
        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: fifthAddr });
        await bRingFarming.methods['stake(address,address,uint256)'](fifthAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: fifthAddr });

        let stakeDetails = await bRingFarming.viewStakingDetails(fifthAddr, 0, 0, { from: fifthAddr });

        assert.equal(stakeDetails[0].length, 1, `user number of stake is wrong`);
        assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `user stake amount is wrong`);

    })

    it("five users should get the same reward in 90 day", async () => {
        let daysPassed = 90;
        await time.increase(time.duration.days(daysPassed - 45)); // 90 - 45
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr];
        let stakeDetails, stakeId, stakeRew, stakeReward;

        for(let i = 0; i < users.length; i++) {
            stakeDetails = await bRingFarming.viewStakingDetails(users[i], 0, 0, { from: users[i] });
            stakeId = stakeDetails[0][0];

            stakeRew = await bRingFarming.getStakeRewards(users[i], stakeId, false, { from: users[i] });
            stakeReward = (Number(stakeRew[0]) * 0.9) / tokenbits;
        }

        let fifthUserStakeDetails = await bRingFarming.viewStakingDetails(fifthAddr, 0, 0, { from: fifthAddr });
        let fifthUserStakeId = fifthUserStakeDetails[0][0];

        let fifthUserStakeRew = await bRingFarming.getStakeRewards(fifthAddr, fifthUserStakeId, true, { from: fifthAddr });
        let fifthUserStakeReward = (Number(fifthUserStakeRew[0]) * 0.9) / tokenbits;

        let rewWithFiveUsers = (stakeReward - Number(fourtyFiveDaysReward)).toFixed(2);
        fifthUserStakeReward = fifthUserStakeReward.toFixed(2);
        assert.equal(rewWithFiveUsers, fifthUserStakeReward, "reward for five users is not the same");
    })
})