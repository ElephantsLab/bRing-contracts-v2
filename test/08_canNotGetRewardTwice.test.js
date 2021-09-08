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

contract("check if user can not get reward twice for the same period", async accounts => {
    const [ deployer, firstAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, thirdToken;
    let firstTokenAddress, secondTokenAddress, thirdTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000

    let stakeAmount = 10000;

    let firstTokenBalance, secondTokenBalance, thirdTokenBalance;

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

    it("user address should have firstToken in his address", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.transfer(firstAddr, (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
        let firstUserBalance = await firstToken.balanceOf.call(firstAddr);
        assert.equal(firstUserBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), "user tokens balance is wrong");
    })

    it("user should be able to do first stake", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(firstAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
    
        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        assert.equal(stakeDetails[0].length, 1, "user stake amount is wrong");
    })

    it("user should NOT get reward twice", async () => {
        let stakingDurationSeconds = Number(await bRingFarming.stakingDuration({ from: deployer }));
        await time.increase(time.duration.seconds(stakingDurationSeconds));

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        
        firstTokenBalance = Number(await firstToken.balanceOf(firstAddr, { from: firstAddr }));
        secondTokenBalance = Number(await secondToken.balanceOf(firstAddr, { from: firstAddr }));
        thirdTokenBalance = Number(await thirdToken.balanceOf(firstAddr, { from: firstAddr }));

        console.log("-------- claimReward 1 -----------");
        console.log("-------- user balance -----------");
        console.log(firstTokenBalance);
        console.log(secondTokenBalance);
        console.log(thirdTokenBalance);

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        console.log("-------- claimReward 2 -----------");
        console.log("-------- user balance -----------");
        console.log(Number(await firstToken.balanceOf(firstAddr, { from: firstAddr })));
        console.log(Number(await secondToken.balanceOf(firstAddr, { from: firstAddr })));
        console.log(Number(await thirdToken.balanceOf(firstAddr, { from: firstAddr })));

        assert.equal(Number(await firstToken.balanceOf(firstAddr, { from: firstAddr })), firstTokenBalance,
            "user firstToken balance after claimReward is wrong");
        assert.equal(Number(await secondToken.balanceOf(firstAddr, { from: firstAddr })), secondTokenBalance,
            "user secondToken balance after claimReward is wrong");
        assert.equal(Number(await thirdToken.balanceOf(firstAddr, { from: firstAddr })), thirdTokenBalance,
            "user thirdToken balance after claimReward is wrong");  
    })

})