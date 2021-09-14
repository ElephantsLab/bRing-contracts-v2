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

contract("check reward with different referral levels and without referrer", async accounts => {
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
        let tokenRewards = [1, 2, 3];
        const rewardsTokenbits = (new BN(10)).pow(new BN(15));

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[2])).mul(rewardsTokenbits)
            ])
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

    it("user makes stake without referrer", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });

        // console.log(await bRingFarming.users(firstAddr, { from: firstAddr }));
    })

    it("users make stake with referrer", async () => {
        let users = [secondAddr, thirdAddr, fourthAddr, fifthAddr, sixthAddr];
        let stakeDetails;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: secondAddr });
        await bRingFarming.stake(secondAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: secondAddr });

        // console.log(await bRingFarming.users(secondAddr, { from: secondAddr }));

        for(let i = 1; i < users.length; i++){
            await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
            await bRingFarming.stake(users[i-1], firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });

            // console.log(`${users[i]}`, await bRingFarming.users(users[i], { from: users[i] }));

            stakeDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });

            // console.log(stakeDetails);
            assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
            assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
        }
    })

    it("get reward", async () => {
        await time.increase(time.duration.hours(1));
        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr, sixthAddr];
        let stakeRew, stakeDetails, stakeId;

        let poolsData = await bRingFarming.pools(firstTokenAddress, { from: firstAddr });
        console.log(Number(poolsData.lastOperationBlock));
        // console.log(Number(poolsData.totalStaked));
        console.log(Number(poolsData[3]));

        // for(let i = 0; i < users.length; i++){
        //     stakeDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });
        //     stakeId = stakeDetails[0][0];

        //     stakeRew = await bRingFarming.getStakeRewards(users[i], stakeId, { from: users[i] });
        //     console.log("-------- after 1 hour -----------");
        //     console.log("-------- getStakeRewards -----------");
        //     console.log(Number(stakeRew[0]));
        //     console.log(Number(stakeRew[1]));
        //     console.log(Number(stakeRew[2]));


        //     await bRingFarming.claimReward(stakeId, { from: users[i] });

        //     console.log("-------- claimReward -----------");
        //     console.log("-------- user balance -----------");
        //     console.log(Number(await firstToken.balanceOf(users[i], { from: users[i] })));
        //     console.log(Number(await secondToken.balanceOf(users[i], { from: users[i] })));
        //     console.log(Number(await thirdToken.balanceOf(users[i], { from: users[i] })));
        // }
    })


})