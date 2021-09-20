const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    constants,    // Common constants, like the zero address and largest integers
    expectEvent,  // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
    time
} = require('@openzeppelin/test-helpers');

contract("check require statements of bRingFarmingOwnable", async accounts => {
    const [ deployer, firstAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, thirdToken;
    let firstTokenAddress, secondTokenAddress, thirdTokenAddress;

    beforeEach(async () => {
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

    it("should revert invalid stakingDuration param in func changeStakingDuration", async () => {
        const invalidStakingDuration = new BN(0);

        await expectRevert(
            bRingFarming.changeStakingDuration(invalidStakingDuration, { from: deployer }),
            'Invalid number of days'
        );
    })

    it("should revert invalid stakeMultiplier param in func changeStakeMultiplier", async () => {
        const invalidStakingDuration = new BN(0);

        await expectRevert(
            bRingFarming.changeStakeMultiplier(invalidStakingDuration, { from: deployer }),
            'Invalid multiplier value'
        );
    })

    it("should revert invalid referralPercents param in func changeReferralPercents", async () => {
        const invalidReferralPercents = [];

        await expectRevert(
            bRingFarming.changeReferralPercents(invalidReferralPercents, { from: deployer }),
            'Invalid referral percents array data'
        );
    })

    it("should revert invalid stakedTokenAddress param in func configPool", async () => {
        const invalidStakedTokenAddress = constants.ZERO_ADDRESS;

        let minStakeAmount = 1;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 1000000; // 1 000 000
        let tokenRewards = [1, 2, 3];

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await expectRevert(
            bRingFarming.configPool(invalidStakedTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
                (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
                [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
                [
                    (new BN(tokenRewards[0])).mul(tokenbits), 
                    (new BN(tokenRewards[1])).mul(tokenbits), 
                    (new BN(tokenRewards[2])).mul(tokenbits)
                ], { from: deployer } ),
                'Invalid token contract address'
        );
    })

    it("should revert invalid minStakeAmount & maxStakeAmount params in func configPool", async () => {
        let lowMinStakeAmount = 0;
        let greaterMinStakeAmount = 500000; // 500 000
        let wrongMaxStakeAmount = 500;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 1000000; // 1 000 000
        let tokenRewards = [1, 2, 3];

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await expectRevert(
            bRingFarming.configPool(firstTokenAddress, (new BN(lowMinStakeAmount)).mul(tokenbits), 
                (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
                [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
                [
                    (new BN(tokenRewards[0])).mul(tokenbits), 
                    (new BN(tokenRewards[1])).mul(tokenbits), 
                    (new BN(tokenRewards[2])).mul(tokenbits)
                ], { from: deployer } ),
                'Invalid min or max stake amounts values'
        );

        await expectRevert(
            bRingFarming.configPool(firstTokenAddress, (new BN(greaterMinStakeAmount)).mul(tokenbits), 
                (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
                [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
                [
                    (new BN(tokenRewards[0])).mul(tokenbits), 
                    (new BN(tokenRewards[1])).mul(tokenbits), 
                    (new BN(tokenRewards[2])).mul(tokenbits)
                ], { from: deployer } ),
                'Invalid min or max stake amounts values'
        );

        await expectRevert(
            bRingFarming.configPool(firstTokenAddress, (new BN(greaterMinStakeAmount)).mul(tokenbits), 
                (new BN(wrongMaxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
                [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
                [
                    (new BN(tokenRewards[0])).mul(tokenbits), 
                    (new BN(tokenRewards[1])).mul(tokenbits), 
                    (new BN(tokenRewards[2])).mul(tokenbits)
                ], { from: deployer } ),
                'Invalid min or max stake amounts values'
        );
    })

    it("should revert invalid totalStakeLimit param in func configPool", async () => {
        let minStakeAmount = 1;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 500000; // 500000
        let tokenRewards = [1, 2, 3];

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await expectRevert(
            bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
                (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
                [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
                [
                    (new BN(tokenRewards[0])).mul(tokenbits), 
                    (new BN(tokenRewards[1])).mul(tokenbits), 
                    (new BN(tokenRewards[2])).mul(tokenbits)
                ], { from: deployer } ),
                'Invalid total stake limit value'
        );
    })

    it("should revert invalid configuration data in func configPool", async () => {
        let minStakeAmount = 1;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 1000000; // 1 000 000
        let tokenRewards = [1, 2, 3];

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await expectRevert(
            bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
                (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
                [], 
                [
                    (new BN(tokenRewards[0])).mul(tokenbits), 
                    (new BN(tokenRewards[1])).mul(tokenbits), 
                    (new BN(tokenRewards[2])).mul(tokenbits)
                ], { from: deployer } ),
                'Invalid configuration data'
        );
    })

    it("should revert Invalid stake index data in func emergencyUnstake", async () => {
        let minStakeAmount = 1;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 1000000; // 1 000 000
        let tokenRewards = [1, 2, 3];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));

        let stakeAmount = 1000;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[2])).mul(rewardsTokenbits)
            ]);

        let tokenContractBalance;
        let tokensNames = [firstToken, secondToken, thirdToken];

        const firstTokenDecimals = await firstToken.decimals();
        const secondTokenDecimals = await secondToken.decimals();
        const thirdTokenDecimals = await thirdToken.decimals();
        const tokensDecimals = [firstTokenDecimals, secondTokenDecimals, thirdTokenDecimals];

        for(let i = 0; i < tokensNames.length; i++){
            let tokenbits = (new BN(10)).pow(tokensDecimals[i]);
            await tokensNames[i].transfer(bRingFarmingAddress, (new BN(maxStakeAmount)).mul(tokenbits), { from: deployer });
            tokenContractBalance = await tokensNames[i].balanceOf.call(bRingFarmingAddress);
            assert.equal(tokenContractBalance.valueOf(), Number((new BN(maxStakeAmount)).mul(tokenbits)), `contract ${tokensNames[i]} balance is wrong`);
        }

        await firstToken.transfer(firstAddr, (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
        let firstUserBalance = await firstToken.balanceOf.call(firstAddr);
        assert.equal(firstUserBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), "user tokens balance is wrong");

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        const userInfo = await bRingFarming.users(firstAddr, { from: deployer });
        let payReferralRewards;

        if(userInfo.referrer == constants.ZERO_ADDRESS) {
            payReferralRewards = false;
        } else {
            payReferralRewards = true;
        }

        await expectRevert(
            bRingFarming.emergencyUnstake(firstAddr, (stakeId + 1), 
            [
                (new BN(1)).mul(tokenbits), 
                (new BN(1)).mul(tokenbits), 
                (new BN(1)).mul(tokenbits)
            ], 
            payReferralRewards, { from: deployer }),
            'Invalid stake index'
        )
    })

    it("should revert Stake was unstaked already in func emergencyUnstake", async () => {
        let minStakeAmount = 1;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 1000000; // 1 000 000
        let tokenRewards = [1, 2, 3];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));

        let stakeAmount = 1000;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[2])).mul(rewardsTokenbits)
            ]);

        let tokenContractBalance;
        let tokensNames = [firstToken, secondToken, thirdToken];

        const firstTokenDecimals = await firstToken.decimals();
        const secondTokenDecimals = await secondToken.decimals();
        const thirdTokenDecimals = await thirdToken.decimals();
        const tokensDecimals = [firstTokenDecimals, secondTokenDecimals, thirdTokenDecimals];

        for(let i = 0; i < tokensNames.length; i++){
            let tokenbits = (new BN(10)).pow(tokensDecimals[i]);
            await tokensNames[i].transfer(bRingFarmingAddress, (new BN(maxStakeAmount)).mul(tokenbits), { from: deployer });
            tokenContractBalance = await tokensNames[i].balanceOf.call(bRingFarmingAddress);
            assert.equal(tokenContractBalance.valueOf(), Number((new BN(maxStakeAmount)).mul(tokenbits)), `contract ${tokensNames[i]} balance is wrong`);
        }

        await firstToken.transfer(firstAddr, (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
        let firstUserBalance = await firstToken.balanceOf.call(firstAddr);
        assert.equal(firstUserBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), "user tokens balance is wrong");

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.unstake(stakeId, { from: firstAddr });

        const userInfo = await bRingFarming.users(firstAddr, { from: deployer });
        let payReferralRewards;

        if(userInfo.referrer == constants.ZERO_ADDRESS) {
            payReferralRewards = false;
        } else {
            payReferralRewards = true;
        }

        await expectRevert(
            bRingFarming.emergencyUnstake(firstAddr, stakeId, 
            [
                (new BN(1)).mul(tokenbits), 
                (new BN(1)).mul(tokenbits), 
                (new BN(1)).mul(tokenbits)
            ], 
            payReferralRewards, { from: deployer }),
            'Stake was unstaked already'
        )
    })

    it("should revert Incorrect rewards array length in func emergencyUnstake", async () => {
        let minStakeAmount = 1;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 1000000; // 1 000 000
        let tokenRewards = [1, 2, 3];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));

        let stakeAmount = 1000;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[2])).mul(rewardsTokenbits)
            ]);

        let tokenContractBalance;
        let tokensNames = [firstToken, secondToken, thirdToken];

        const firstTokenDecimals = await firstToken.decimals();
        const secondTokenDecimals = await secondToken.decimals();
        const thirdTokenDecimals = await thirdToken.decimals();
        const tokensDecimals = [firstTokenDecimals, secondTokenDecimals, thirdTokenDecimals];

        for(let i = 0; i < tokensNames.length; i++){
            let tokenbits = (new BN(10)).pow(tokensDecimals[i]);
            await tokensNames[i].transfer(bRingFarmingAddress, (new BN(maxStakeAmount)).mul(tokenbits), { from: deployer });
            tokenContractBalance = await tokensNames[i].balanceOf.call(bRingFarmingAddress);
            assert.equal(tokenContractBalance.valueOf(), Number((new BN(maxStakeAmount)).mul(tokenbits)), `contract ${tokensNames[i]} balance is wrong`);
        }

        await firstToken.transfer(firstAddr, (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
        let firstUserBalance = await firstToken.balanceOf.call(firstAddr);
        assert.equal(firstUserBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), "user tokens balance is wrong");

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        const userInfo = await bRingFarming.users(firstAddr, { from: deployer });
        let payReferralRewards;

        if(userInfo.referrer == constants.ZERO_ADDRESS) {
            payReferralRewards = false;
        } else {
            payReferralRewards = true;
        }

        await expectRevert(
            bRingFarming.emergencyUnstake(firstAddr, stakeId, 
            [
                (new BN(1)).mul(tokenbits), 
                (new BN(1)).mul(tokenbits)
            ], 
            payReferralRewards, { from: deployer }),
            'Incorrect rewards array length'
        )
    })

    it("should revert invalid amount in func retrieveTokens", async () => {
        let amount = 0;

        await expectRevert(
            bRingFarming.retrieveTokens(firstTokenAddress, amount, { from: deployer }),
            'Invalid amount'
        )
    })

    it("should revert insufficient balance in func retrieveTokens", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let transferAmount = 100000;
        let retrieveAmount = 500000;             

        await firstToken.transfer(bRingFarmingAddress, (new BN(transferAmount)).mul(tokenbits), { from: deployer });
        let contractBalance = await firstToken.balanceOf.call(bRingFarmingAddress);
        assert.equal(contractBalance.valueOf(), Number((new BN(transferAmount)).mul(tokenbits)), "contract tokens balance is wrong");

        await expectRevert(
            bRingFarming.retrieveTokens(firstTokenAddress, (new BN(retrieveAmount)).mul(tokenbits), { from: deployer }),
            'Insufficient Balance'
        )
    })

    // it("should revert transfer failed in func retrieveTokens", async () => {
    //     const decimals = await firstToken.decimals();
    //     const tokenbits = (new BN(10)).pow(decimals);

    //     let transferAmount = 100000;
    //     let retrieveAmount = 500000;             

    //     await firstToken.transfer(bRingFarmingAddress, (new BN(transferAmount)).mul(tokenbits), { from: deployer });
    //     let contractBalance = await firstToken.balanceOf.call(bRingFarmingAddress);
    //     assert.equal(contractBalance.valueOf(), Number((new BN(transferAmount)).mul(tokenbits)), "contract tokens balance is wrong");

    //     await bRingFarming.retrieveTokens(secondTokenAddress, (new BN(retrieveAmount)).mul(tokenbits), { from: deployer });
    // })
})