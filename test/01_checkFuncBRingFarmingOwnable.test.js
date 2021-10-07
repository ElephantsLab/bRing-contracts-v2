const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    constants,    // Common constants, like the zero address and largest integers
    expectRevert, // Assertions for transactions that should fail
    time
} = require('@openzeppelin/test-helpers');

contract("check functionality of bRingFarmingOwnable", async accounts => {
    const [ deployer, anotherWallet, firstAddr ] = accounts;

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

    it("should revert for NOT owner caller func 'changeStakingDuration'", async () => {
        const newStakingDuration = new BN(10);

        await expectRevert(
            bRingFarming.changeStakingDuration(newStakingDuration, { from: anotherWallet }),
            'Ownable: caller is not the owner'
        );
    })

    it("owner should be able change staking duration", async () => {
        const newStakingDuration = new BN(10);

        await bRingFarming.changeStakingDuration(newStakingDuration, { from: deployer });
        let stakingDuration = await bRingFarming.stakingDuration({ from: deployer });

        assert.equal((stakingDuration / 24 / 3600), newStakingDuration, "staking duration is wrong");
    })

    it("should revert for NOT owner caller func changeStakeMultiplier", async () => {
        const stakeMultiplier = new BN(1);

        await expectRevert(
            bRingFarming.changeStakeMultiplier(stakeMultiplier, { from: anotherWallet }),
            'Ownable: caller is not the owner'
        );
    })

    it("owner should be able change stake multiplier", async () => {
        const newStakeMultiplier = 2;

        await bRingFarming.changeStakeMultiplier(newStakeMultiplier, { from: deployer });
        let stakeMultiplier = await bRingFarming.stakeMultiplier({ from: deployer });

        assert.equal(stakeMultiplier, newStakeMultiplier, "stake multiplier is wrong");
    })

    it("should revert for NOT owner caller func 'changeReferralPercents'", async () => {
        const newRefPercents = [5, 4, 3, 2];

        await expectRevert(
            bRingFarming.changeReferralPercents(newRefPercents, { from: anotherWallet }),
            'Ownable: caller is not the owner'
        );
    })

    it("owner should be able change 'referralPercents'", async () => {
        const newRefPercents = [ 5, 4, 3, 2 ];
        await bRingFarming.changeReferralPercents(newRefPercents, { from: deployer });

        let referralPercents = [];
        for(let i = 0; i < newRefPercents.length; i++) {
            referralPercents.push(Number(await bRingFarming.referralPercents([i], { from: deployer }) ));
        }

        expect(referralPercents).to.deep.equal(newRefPercents);
    })

    it("should revert for NOT owner caller func 'configPool'", async () => {
        let minStakeAmount = 1;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 1000000; // 1 000 000
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
                ],
                constants.ZERO_ADDRESS,
                0, { from: anotherWallet }),
                'Ownable: caller is not the owner'
        );
    })

    it("should revert for NOT owner caller func 'emergencyUnstake'", async () => {
        let minStakeAmount = 1;
        let maxStakeAmount = 500000; // 500 000
        let totalStakeLimit = 1000000; // 1 000 000
        let tokenRewards = [1, 2, 3];

        let stakeAmount = 1000;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
            [(new BN(tokenRewards[0])).mul(tokenbits), (new BN(tokenRewards[1])).mul(tokenbits), (new BN(tokenRewards[2])).mul(tokenbits)],
            constants.ZERO_ADDRESS,
            0);

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

        await firstToken.transfer(firstAddr, (new BN((stakeAmount * 2))).mul(tokenbits), { from: deployer });
        let firstUserBalance = await firstToken.balanceOf.call(firstAddr);
        assert.equal(firstUserBalance.valueOf(), Number((new BN((stakeAmount * 2))).mul(tokenbits)), "user tokens balance is wrong");

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
            bRingFarming.emergencyUnstake(firstAddr, stakeId, [1, 1, 1], payReferralRewards, { from: anotherWallet }),
            'Ownable: caller is not the owner'
        );       
    })

    it("owner should be able to call func 'emergencyUnstake' for stake without refferer", async () => {
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
            ],
            constants.ZERO_ADDRESS,
            0);

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

        await bRingFarming.emergencyUnstake(firstAddr, stakeId, 
            [
                (new BN(1)).mul(tokenbits), 
                (new BN(0)).mul(tokenbits), 
                (new BN(1)).mul(tokenbits)
            ], 
            payReferralRewards, { from: deployer });

        let userFirstTokenBalance = await firstToken.balanceOf.call(firstAddr);
        let userSecondTokenBalance = await secondToken.balanceOf.call(firstAddr);
        let userThirdTokenBalance = await thirdToken.balanceOf.call(firstAddr);
        assert.equal(userFirstTokenBalance, Number((new BN(1)).mul(tokenbits)) + Number((new BN(stakeAmount)).mul(tokenbits)), 
            "user firstToken balance is wrong");
        assert.equal(userSecondTokenBalance, Number((new BN(0)).mul(tokenbits)), "user secondToken balance is wrong");
        assert.equal(userThirdTokenBalance, Number((new BN(1)).mul(tokenbits)), "user thirdToken balance is wrong");  
    })

    it("owner should be able to call func 'emergencyUnstake' for stake with refferer", async () => {
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
            ],
            constants.ZERO_ADDRESS,
            0);

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

        let users = [anotherWallet, firstAddr];
        let userBalance;

        for(let i = 0; i < users.length; i++) {
            await firstToken.transfer(users[i], (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
            userBalance = await firstToken.balanceOf.call(users[i]);
            assert.equal(userBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user tokens balance is wrong`);
        }

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: anotherWallet });
        await bRingFarming.stake(anotherWallet, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: anotherWallet });

        await time.increase(time.duration.hours(1));
        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(anotherWallet, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        const userInfo = await bRingFarming.users(firstAddr, { from: deployer });
        let payReferralRewards;

        if(userInfo.referrer == constants.ZERO_ADDRESS) {
            payReferralRewards = false;
        } else {
            payReferralRewards = true;
        }

        await bRingFarming.emergencyUnstake(firstAddr, stakeId, 
            [
                (new BN(10)).mul(tokenbits), 
                (new BN(10)).mul(tokenbits), 
                (new BN(10)).mul(tokenbits)
            ], 
            payReferralRewards, { from: deployer });

        let userFirstTokenBalance = await firstToken.balanceOf.call(firstAddr);
        let userSecondTokenBalance = await secondToken.balanceOf.call(firstAddr);
        let userThirdTokenBalance = await thirdToken.balanceOf.call(firstAddr);
        assert.equal(userFirstTokenBalance, Number((new BN(10)).mul(tokenbits)) + Number((new BN(stakeAmount)).mul(tokenbits)), 
            "user firstToken balance is wrong");
        assert.equal(userSecondTokenBalance, Number((new BN(10)).mul(tokenbits)), "user secondToken balance is wrong");
        assert.equal(userThirdTokenBalance, Number((new BN(10)).mul(tokenbits)), "user thirdToken balance is wrong");  
    })

    it("should revert for NOT owner caller func 'retrieveTokens'", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let transferAmount = 500000;
        let retrieveAmount = 100000;

        await firstToken.transfer(bRingFarmingAddress, (new BN(transferAmount)).mul(tokenbits), { from: deployer });
        let contractBalance = await firstToken.balanceOf.call(bRingFarmingAddress);
        assert.equal(contractBalance.valueOf(), Number((new BN(transferAmount)).mul(tokenbits)), "contract tokens balance is wrong");
        
        await expectRevert(
            bRingFarming.retrieveTokens(firstTokenAddress, (new BN(retrieveAmount)).mul(tokenbits), { from: anotherWallet }),
            'Ownable: caller is not the owner'
        );
    })

    it("owner should be able to call func 'retrieveTokens'", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let transferAmount = 500000;
        let retrieveAmount = 100000;      

        await firstToken.transfer(bRingFarmingAddress, (new BN(transferAmount)).mul(tokenbits), { from: deployer });
        let contractBalance = await firstToken.balanceOf.call(bRingFarmingAddress);
        assert.equal(contractBalance.valueOf(), Number((new BN(transferAmount)).mul(tokenbits)), "contract tokens balance is wrong");

        await bRingFarming.retrieveTokens(firstTokenAddress, (new BN(retrieveAmount)).mul(tokenbits), { from: deployer });
        
        let newContractBalance = await firstToken.balanceOf.call(bRingFarmingAddress);

        assert.equal(Number(contractBalance - (new BN(retrieveAmount)).mul(tokenbits)), newContractBalance.valueOf(), 
            "contract tokens balance is wrong");
    })
})