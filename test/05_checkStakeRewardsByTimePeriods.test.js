const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    expectEvent,  // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
    time
} = require('@openzeppelin/test-helpers');

contract("check if reward given by time periods", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr, sixthAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, thirdToken;
    let firstTokenAddress, secondTokenAddress, thirdTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000

    let stakeAmount = 10000;

    before(async () => {
        // tokens deployed
        firstToken = await FirstToken.deployed({ from: deployer });
        firstTokenAddress = firstToken.address;

        secondToken = await SecondToken.deployed({ from: deployer });
        secondTokenAddress = secondToken.address;

        thirdToken = await ThirdToken.deployed({ from: deployer });
        thirdTokenAddress = thirdToken.address;

        // contract deployed
        bRingFarming = await bRingFarmingContract.deployed({ from: deployer });
        bRingFarmingAddress = bRingFarming.address;
    })

    it("config Pool", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        let tokenRewards = [4, 5, 6];

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
            [(new BN(tokenRewards[0])).mul(tokenbits), (new BN(tokenRewards[1])).mul(tokenbits), (new BN(tokenRewards[2])).mul(tokenbits)])
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

    it("users should be able to do stake", async () => {
        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr, sixthAddr];
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

    // it("user should NOT get revard after claim tokens in 59 minutes", async () => {

    //     console.log("-------- user balance -----------");
    //     console.log(Number(await firstToken.balanceOf.call(firstAddr)));
    //     console.log(Number(await secondToken.balanceOf.call(firstAddr)));
    //     console.log(Number(await thirdToken.balanceOf.call(firstAddr)));
    //     console.log("--------  -----------");

    //     await time.increase(time.duration.seconds(1));

    //     let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
    //     let stakeId = stakeDetails[0][0];

    //     let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId, { from: firstAddr });
    //     console.log("-------- start 59 min -----------");
    //     console.log("-------- getStakeRewards -----------");
    //     console.log(Number(stakeRew[0]));
    //     console.log(Number(stakeRew[1]));
    //     console.log(Number(stakeRew[2]));
    //     await bRingFarming.claimReward(stakeId, { from: firstAddr });

    //     console.log("-------- user balance -----------");
    //     console.log(Number(await firstToken.balanceOf.call(firstAddr)));
    //     console.log(Number(await secondToken.balanceOf.call(firstAddr)));
    //     console.log(Number(await thirdToken.balanceOf.call(firstAddr)));
    //     console.log("-------- end 59 min -----------");
    // })

    it("user should get revard after claim tokens in 1 hour", async () => {
        await time.increase(time.duration.hours(1));

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId, { from: firstAddr });
        console.log("-------- after 1 hour -----------");
        console.log("-------- getStakeRewards -----------");
        console.log(Number(stakeRew[0]));
        console.log(Number(stakeRew[1]));
        console.log(Number(stakeRew[2]));

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        console.log("-------- claimReward -----------");
        console.log("-------- user balance -----------");
        console.log(Number(await firstToken.balanceOf.call(firstAddr)));
        console.log(Number(await secondToken.balanceOf.call(firstAddr)));
        console.log(Number(await thirdToken.balanceOf.call(firstAddr)));

        expect(Number(await firstToken.balanceOf.call(firstAddr))).to.be.above(0);
        expect(Number(await secondToken.balanceOf.call(firstAddr))).to.be.above(0);
        expect(Number(await thirdToken.balanceOf.call(firstAddr))).to.be.above(0);
        console.log("-------- end claimReward -----------");
    })

    // it("user should be able unstake tokens", async () => {
    //     let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
    //     let stakeId = stakeDetails[0][0];

    //     await bRingFarming.unstake(stakeId, { from: firstAddr });

    //     console.log("-------- unstake -----------");
    //     console.log("-------- user balance -----------");
    //     console.log(Number(await firstToken.balanceOf.call(firstAddr)));
    //     console.log(Number(await secondToken.balanceOf.call(firstAddr)));
    //     console.log(Number(await thirdToken.balanceOf.call(firstAddr)));
    // })
})