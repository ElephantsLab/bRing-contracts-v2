const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");

const BRingToken = artifacts.require("bRingToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    time
} = require('@openzeppelin/test-helpers');

contract("check reward with different referral levels and without referrer", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr, sixthAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, BRNGToken;
    let firstTokenAddress, secondTokenAddress, BRNGTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000

    let stakeAmount = 10000;

    const referralMultiplier = 10000000000;
    const referralPercents = [3, 2, 1];

    before(async () => {
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

    it("config Pool", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        let tokenRewards = [1, 2];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));

        const maxPenalty = new BN(0);
        const penaltyDuration = 45 * 24 * 3600;

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits)
            ],
            maxPenalty, penaltyDuration, deployer,
            BRNGTokenAddress,
            referralMultiplier)
    })

    it("send tokens to the contract address", async () => {
        let tokenContractBalance;
        let tokensNames = [firstToken, secondToken, BRNGToken];

        const firstTokenDecimals = await firstToken.decimals();
        const secondTokenDecimals = await secondToken.decimals();
        const BRNGTokenDecimals = await BRNGToken.decimals();
        const decimals = [firstTokenDecimals, secondTokenDecimals, BRNGTokenDecimals];

        for(let i = 0; i < tokensNames.length; i++){
            let tokenbits = (new BN(10)).pow(decimals[i]);
            await tokensNames[i].transfer(bRingFarmingAddress, (new BN(maxStakeAmount)).mul(tokenbits), { from: deployer });
            tokenContractBalance = await tokensNames[i].balanceOf.call(bRingFarmingAddress);
            assert.equal(tokenContractBalance.valueOf(), Number((new BN(maxStakeAmount)).mul(tokenbits)), `contract ${tokensNames[i]} balance is wrong`);
        }
    })

    it("users should have firstToken in their addresses", async () => {
        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr, sixthAddr];
        let userBalance;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        for(let i = 0; i < users.length; i++) {
            await firstToken.transfer(users[i], (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
            userBalance = await firstToken.balanceOf.call(users[i]);
            assert.equal(userBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user tokens balance is wrong`);
        }
    })

    it("user makes stake without referrer", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.methods['stake(address,address,uint256)'](firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });

    })

    it("users make stake with referrer", async () => {
        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr, sixthAddr];
        let stakeDetails;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        for(let i = 1; i < users.length; i++){
            await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
            await bRingFarming.methods['stake(address,address,uint256)'](users[i-1], firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });

            stakeDetails = await bRingFarming.viewStakingDetails(users[i], 0, 0, { from: users[i] });

            assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
            assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
        }
    })

    it("second user make unstake and first user get ref payouts", async () => {
        await time.increase(time.duration.days(90));

        const decimals = await BRNGToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let stakeDetails = await bRingFarming.viewStakingDetails(secondAddr, 0, 0, { from: secondAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(secondAddr, stakeId, { from: secondAddr });

        await bRingFarming.unstake(stakeId, { from: secondAddr });

        let expectedFirstLineRefPayouts = 0, expectedPayouts;
        for(let i = 0; i < stakeRew.length; i++) {
            if(Number(stakeRew[i]) != 0) {
                expectedPayouts = Number((Number(stakeRew[i]) * referralPercents[0] * referralMultiplier / Math.pow(10, 10) / 100)  / tokenbits);
                expectedFirstLineRefPayouts += expectedPayouts;
            }           
        }

        let firstUserBalance = Number(await BRNGToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits;
        
        console.log("--------");
        console.log("manual ref payouts", expectedFirstLineRefPayouts);
        console.log("1 user bal payouts", firstUserBalance);
        console.log("--------");

        assert.equal(expectedFirstLineRefPayouts.toFixed(4), firstUserBalance.toFixed(4), "referral payouts is wrong"); 
    })

    it("third user make unstake & first and second users get ref payouts", async () => {
        const decimals = await BRNGToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let stakeDetails = await bRingFarming.viewStakingDetails(thirdAddr, 0, 0, { from: thirdAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(thirdAddr, stakeId, { from: thirdAddr });

        await bRingFarming.unstake(stakeId, { from: thirdAddr });

        let expectedFirstLineRefPayouts = 0, expectedSecondLineRefPayouts = 0;
        let expectedPayoutsThreePercents, expectedPayoutsTwoPercents;
        for(let i = 0; i < stakeRew.length; i++) {
            if(Number(stakeRew[i]) != 0) {
                expectedPayoutsThreePercents = Number((Number(stakeRew[i]) * referralPercents[0] * referralMultiplier / Math.pow(10, 10) / 100)  / tokenbits);
                expectedPayoutsTwoPercents = Number((Number(stakeRew[i]) * referralPercents[1] * referralMultiplier / Math.pow(10, 10) / 100)  / tokenbits);
                expectedFirstLineRefPayouts += expectedPayoutsThreePercents;
                expectedSecondLineRefPayouts += expectedPayoutsTwoPercents;
            }           
        }

        let firstUserBalance = Number(await BRNGToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits;
        let secondUserBalance = Number(await BRNGToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits;

        console.log("--------");
        console.log("manual ref payouts", expectedFirstLineRefPayouts + expectedSecondLineRefPayouts);
        console.log("1 user bal payouts", firstUserBalance);
        console.log("---");
        console.log("manual ref payouts", expectedFirstLineRefPayouts);       
        console.log("2 user bal payouts", secondUserBalance);
        console.log("--------");

        assert.equal((expectedFirstLineRefPayouts + expectedSecondLineRefPayouts).toFixed(3), firstUserBalance.toFixed(3), "referral payouts is wrong (firstAddr)"); 
        assert.equal(expectedFirstLineRefPayouts.toFixed(3), secondUserBalance.toFixed(3), "referral payouts is wrong (secondAddr)");    
    })

    it("fourth user make unstake & first, second and third users get ref payouts", async () => {
        const decimals = await BRNGToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let stakeDetails = await bRingFarming.viewStakingDetails(fourthAddr, 0, 0, { from: fourthAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(fourthAddr, stakeId, { from: fourthAddr });

        await bRingFarming.unstake(stakeId, { from: fourthAddr });

        let expectedFirstLineRefPayouts = 0, expectedSecondLineRefPayouts = 0, expectedThirdLineRefPayouts = 0;
        let expectedPayoutsThreePercents, expectedPayoutsTwoPercents, expectedPayoutsOnePercent;
        for(let i = 0; i < stakeRew.length; i++) {
            if(Number(stakeRew[i]) != 0) {
                expectedPayoutsThreePercents = Number((Number(stakeRew[i]) * referralPercents[0] * referralMultiplier / Math.pow(10, 10) / 100)  / tokenbits);
                expectedPayoutsTwoPercents = Number((Number(stakeRew[i]) * referralPercents[1] * referralMultiplier / Math.pow(10, 10) / 100)  / tokenbits);
                expectedPayoutsOnePercent = Number((Number(stakeRew[i]) * referralPercents[2] * referralMultiplier / Math.pow(10, 10) / 100)  / tokenbits);
                expectedFirstLineRefPayouts += expectedPayoutsThreePercents;
                expectedSecondLineRefPayouts += expectedPayoutsTwoPercents;
                expectedThirdLineRefPayouts += expectedPayoutsOnePercent;
            }           
        }

        let firstUserBalance = Number(await BRNGToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits;
        let secondUserBalance = Number(await BRNGToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits;
        let thirdUserBalance = Number(await BRNGToken.balanceOf(thirdAddr, { from: thirdAddr })) / tokenbits;

        console.log("--------");
        console.log("manual ref payouts", expectedFirstLineRefPayouts + expectedSecondLineRefPayouts + expectedThirdLineRefPayouts);
        console.log("1 user bal payouts", firstUserBalance);
        console.log("---");
        console.log("manual ref payouts", expectedFirstLineRefPayouts + expectedSecondLineRefPayouts);       
        console.log("2 user bal payouts", secondUserBalance);
        console.log("---");
        console.log("manual ref payouts", expectedFirstLineRefPayouts);
        console.log("3 user bal payouts", thirdUserBalance);
        console.log("--------");

        assert.equal((expectedFirstLineRefPayouts + expectedSecondLineRefPayouts + expectedThirdLineRefPayouts).toFixed(3), 
            firstUserBalance.toFixed(3), "referral payouts is wrong (firstAddr)");
        assert.equal((expectedFirstLineRefPayouts + expectedSecondLineRefPayouts).toFixed(3), secondUserBalance.toFixed(3), "referral payouts is wrong (secondAddr)");
        assert.equal(expectedFirstLineRefPayouts.toFixed(3), thirdUserBalance.toFixed(3), "referral payouts is wrong (thirdAddr)");      
    })
})