const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    time,
    constants
} = require('@openzeppelin/test-helpers');

contract("check reward with different referral levels and without referrer", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken;
    let firstTokenAddress, secondTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000

    let stakeAmount = 10000;

    const referralPercents = [3, 2, 1];

    let secondUser1TokenBalance, secondUser2TokenBalance;
    let thirdUser1TokenBalance, thirdUser2TokenBalance;

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
        let tokenRewards = [1, 1];
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
        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr];
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
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });

    })

    it("users make stake with referrer", async () => {
        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr];
        let stakeDetails;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        for(let i = 1; i < users.length; i++){
            await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
            await bRingFarming.stake(users[i-1], firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });

            stakeDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });

            assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
            assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
        }
    })

    it("second user make unstake and first user get ref payouts", async () => {
        await time.increase(time.duration.days(90));

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let stakeDetails = await bRingFarming.viewStakingDetails(secondAddr, { from: secondAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(secondAddr, stakeId, { from: secondAddr });

        await bRingFarming.unstake(stakeId, { from: secondAddr });

        secondUser1TokenBalance = Number(await firstToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits;
        secondUser2TokenBalance = Number(await secondToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits;

        let expectedRefPayouts = ((Number(stakeRew[0]) * 3 / 100) / tokenbits).toFixed(4);

        let userFirstTokenBalance = (Number(await firstToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits).toFixed(4);
        let userSecondTokenBalance = (Number(await secondToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits).toFixed(4);

        assert.equal(expectedRefPayouts, userFirstTokenBalance, "firstToken referral payouts is wrong");
        assert.equal(expectedRefPayouts, userSecondTokenBalance, "secondToken referral payouts is wrong");
    })

    it("third user make unstake & first and second users get ref payouts", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let stakeDetails = await bRingFarming.viewStakingDetails(thirdAddr, { from: thirdAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(thirdAddr, stakeId, { from: thirdAddr });

        await bRingFarming.unstake(stakeId, { from: thirdAddr });

        thirdUser1TokenBalance = Number(await firstToken.balanceOf(thirdAddr, { from: thirdAddr })) / tokenbits;
        thirdUser2TokenBalance = Number(await secondToken.balanceOf(thirdAddr, { from: thirdAddr })) / tokenbits;

        let expFirstLineRefPayouts = (Number(stakeRew[0]) * referralPercents[0] / 100) / tokenbits;
        let expSecondLineRefPayouts = (Number(stakeRew[0]) * referralPercents[1] / 100) / tokenbits;

        let firstUserFirstTokenBal = (Number(await firstToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits).toFixed(4);
        let firstUserSecondTokenBal = (Number(await secondToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits).toFixed(4);

        assert.equal((Number(expFirstLineRefPayouts) + Number(expSecondLineRefPayouts)).toFixed(4), firstUserFirstTokenBal, 
            "firstToken referral payouts is wrong (firstAddr)");

        assert.equal((Number(expFirstLineRefPayouts) + Number(expSecondLineRefPayouts)).toFixed(4), firstUserSecondTokenBal, 
            "secondToken referral payouts is wrong (firstAddr)");

        let secondUserFirstTokenBal = (Number(await firstToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits);
        let secondUserSecondTokenBal = (Number(await secondToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits);

        assert.equal((expFirstLineRefPayouts).toFixed(4), (secondUserFirstTokenBal - secondUser1TokenBalance).toFixed(4), 
            "firstToken referral payouts is wrong (secondAddr)");
        assert.equal((expFirstLineRefPayouts).toFixed(4), (secondUserSecondTokenBal - secondUser2TokenBalance).toFixed(4), 
            "secondToken referral payouts is wrong (secondAddr)");

    })

    it("fourth user make unstake & first, second and third users get ref payouts", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let stakeDetails = await bRingFarming.viewStakingDetails(fourthAddr, { from: fourthAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(fourthAddr, stakeId, { from: fourthAddr });

        await bRingFarming.unstake(stakeId, { from: fourthAddr });

        let expFirstLineRefPayouts = (Number(stakeRew[0]) * referralPercents[0] / 100) / tokenbits;
        let expSecondLineRefPayouts = (Number(stakeRew[0]) * referralPercents[1] / 100) / tokenbits;
        let expThirdLineRefPayouts = (Number(stakeRew[0]) * referralPercents[2] / 100) / tokenbits;

        let firstUserFirstTokenBal = (Number(await firstToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits).toFixed(3);
        let firstUserSecondTokenBal = (Number(await secondToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits).toFixed(3);

        assert.equal((Number(expFirstLineRefPayouts) + Number(expSecondLineRefPayouts) + Number(expThirdLineRefPayouts)).toFixed(3), firstUserFirstTokenBal, 
            "firstToken referral payouts is wrong (firstAddr)");

        assert.equal((Number(expFirstLineRefPayouts) + Number(expSecondLineRefPayouts) + Number(expThirdLineRefPayouts)).toFixed(3), firstUserSecondTokenBal, 
            "secondToken referral payouts is wrong (firstAddr)");

        let secondUserFirstTokenBal = (Number(await firstToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits);
        let secondUserSecondTokenBal = (Number(await secondToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits);

        assert.equal((Number(expFirstLineRefPayouts) + Number(expSecondLineRefPayouts)).toFixed(3), (secondUserFirstTokenBal - secondUser1TokenBalance).toFixed(3), 
            "firstToken referral payouts is wrong (secondAddr)");
        assert.equal((Number(expFirstLineRefPayouts) + Number(expSecondLineRefPayouts)).toFixed(3), (secondUserSecondTokenBal - secondUser2TokenBalance).toFixed(3), 
            "secondToken referral payouts is wrong (secondAddr)");

        let thirdUserFirstTokenBal = (Number(await firstToken.balanceOf(thirdAddr, { from: thirdAddr })) / tokenbits);
        let thirdUserSecondTokenBal = (Number(await secondToken.balanceOf(thirdAddr, { from: thirdAddr })) / tokenbits);

        assert.equal((expFirstLineRefPayouts).toFixed(4), (thirdUserFirstTokenBal - thirdUser1TokenBalance).toFixed(4), 
            "firstToken referral payouts is wrong (thirdAddr)");
        assert.equal((expFirstLineRefPayouts).toFixed(4), (thirdUserSecondTokenBal - thirdUser2TokenBalance).toFixed(4), 
            "secondToken referral payouts is wrong (thirdAddr)");

    })
})