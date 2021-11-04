const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    time,
    constants
} = require('@openzeppelin/test-helpers');

contract("check stake reward distribution without referrer", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, thirdToken;
    let firstTokenAddress, secondTokenAddress, thirdTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000

    let stakeAmount = 10000;

    let firstUserBalance1Token, firstUserBalance2Token, firstUserBalance3Token;
    let secondUserBalance1Token, secondUserBalance2Token, secondUserBalance3Token;
    let thirdUserBalance1Token, thirdUserBalance2Token, thirdUserBalance3Token;
    let fourthUserBalance1Token, fourthUserBalance2Token, fourthUserBalance3Token;

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
        let tokenRewards = [1, 2, 3];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));

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
        let users = [ firstAddr, secondAddr, thirdAddr, fourthAddr ];
        let userBalance;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        for(let i = 0; i < users.length; i++) {
            await firstToken.transfer(users[i], (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
            userBalance = await firstToken.balanceOf.call(users[i]);
            assert.equal(userBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user tokens balance is wrong`);
        }
    })

    it("users make stake without referrer", async () => {
        let users = [ firstAddr, secondAddr, thirdAddr, fourthAddr ];
        let stakeDetails;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        for(let i = 0; i < users.length; i++){
            await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
            await bRingFarming.stake(users[i], firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });

            stakeDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });

            assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
            assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
        }
    })

    it("first user unstake and get his reward after 90 days", async () => {
        await time.increase(time.duration.days(90));

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.unstake(stakeId, { from: firstAddr });

        firstUserBalance1Token = Number(await firstToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits;
        firstUserBalance2Token = Number(await secondToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits;
        firstUserBalance3Token = Number(await thirdToken.balanceOf(firstAddr, { from: firstAddr })) / tokenbits;

        console.log(firstUserBalance1Token / tokenbits);
        console.log(firstUserBalance2Token / tokenbits);
        console.log(firstUserBalance3Token / tokenbits);
    })

    it("second user unstake and get his reward after 90 days", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let stakeDetails = await bRingFarming.viewStakingDetails(secondAddr, { from: secondAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.unstake(stakeId, { from: secondAddr });

        secondUserBalance1Token = Number(await firstToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits;
        secondUserBalance2Token = Number(await secondToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits;
        secondUserBalance3Token = Number(await thirdToken.balanceOf(secondAddr, { from: secondAddr })) / tokenbits;

        console.log(secondUserBalance1Token / tokenbits);
        console.log(secondUserBalance2Token / tokenbits);
        console.log(secondUserBalance3Token / tokenbits);

        assert.equal(secondUserBalance1Token.toFixed(2), firstUserBalance1Token.toFixed(2), "second user first token reward is wrong");
        assert.equal(secondUserBalance2Token.toFixed(2), firstUserBalance2Token.toFixed(2), "second user second token reward is wrong");
        assert.equal(secondUserBalance3Token.toFixed(2), firstUserBalance3Token.toFixed(2), "second user third token reward is wrong");
    })

    it("third user unstake and get his reward after 90 days", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let stakeDetails = await bRingFarming.viewStakingDetails(thirdAddr, { from: thirdAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.unstake(stakeId, { from: thirdAddr });

        thirdUserBalance1Token = Number(await firstToken.balanceOf(thirdAddr, { from: thirdAddr })) / tokenbits;
        thirdUserBalance2Token = Number(await secondToken.balanceOf(thirdAddr, { from: thirdAddr })) / tokenbits;
        thirdUserBalance3Token = Number(await thirdToken.balanceOf(thirdAddr, { from: thirdAddr })) / tokenbits;

        console.log(thirdUserBalance1Token / tokenbits);
        console.log(thirdUserBalance2Token / tokenbits);
        console.log(thirdUserBalance3Token / tokenbits);

        assert.equal(thirdUserBalance1Token.toFixed(2), secondUserBalance1Token.toFixed(2), "third user first token reward is wrong");
        assert.equal(thirdUserBalance2Token.toFixed(2), secondUserBalance2Token.toFixed(2), "third user second token reward is wrong");
        assert.equal(thirdUserBalance3Token.toFixed(2), secondUserBalance3Token.toFixed(2), "third user third token reward is wrong");
    })

    it("fourth user unstake and get his reward after 90 days", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let stakeDetails = await bRingFarming.viewStakingDetails(fourthAddr, { from: fourthAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.unstake(stakeId, { from: fourthAddr });

        fourthUserBalance1Token = Number(await firstToken.balanceOf(fourthAddr, { from: fourthAddr })) / tokenbits;
        fourthUserBalance2Token = Number(await secondToken.balanceOf(fourthAddr, { from: fourthAddr })) / tokenbits;
        fourthUserBalance3Token = Number(await thirdToken.balanceOf(fourthAddr, { from: fourthAddr })) / tokenbits;

        console.log(fourthUserBalance1Token / tokenbits);
        console.log(fourthUserBalance2Token / tokenbits);
        console.log(fourthUserBalance3Token / tokenbits);

        assert.equal(fourthUserBalance1Token.toFixed(2), thirdUserBalance1Token.toFixed(2), "fourth user first token reward is wrong");
        assert.equal(fourthUserBalance2Token.toFixed(2), thirdUserBalance2Token.toFixed(2), "fourth user second token reward is wrong");
        assert.equal(fourthUserBalance3Token.toFixed(1), thirdUserBalance3Token.toFixed(1), "fourth user third token reward is wrong");
    })
})