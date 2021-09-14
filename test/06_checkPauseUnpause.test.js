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

contract("check pause and unpause logic", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, thirdToken;
    let firstTokenAddress, secondTokenAddress, thirdTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000

    let stakeAmount = 1000;

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

        await firstToken.transfer(firstAddr, (new BN((stakeAmount * 2))).mul(tokenbits), { from: deployer });
        let firstUserBalance = await firstToken.balanceOf.call(firstAddr);
        assert.equal(firstUserBalance.valueOf(), Number((new BN((stakeAmount * 2))).mul(tokenbits)), "user tokens balance is wrong");
    })

    it("user should be able to do first stake", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(secondAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
    
        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        assert.equal(stakeDetails[0].length, 1, "user stake amount is wrong");
    })

    it("should revert stake after called pause by owner", async () => {
        await bRingFarming.pause({ from: deployer });

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await expectRevert(
            bRingFarming.stake(secondAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr }),
            'Pausable: paused'
        );
    })

    it("should revert claim reward if contract paused", async () => {
        await time.increase(time.duration.days(1));

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId, { from: firstAddr });
        console.log(Number(stakeRew[0]));
        console.log(Number(stakeRew[1]));
        console.log(Number(stakeRew[2]));

        await expectRevert(
            bRingFarming.claimReward(stakeId, { from: firstAddr }),
            'Pausable: paused'
        ); 
        // await bRingFarming.claimReward(stakeId, { from: firstAddr });
        // console.log(await secondToken.balanceOf.call(firstAddr));
        // console.log(await firstToken.balanceOf.call(firstAddr));
        // console.log(await thirdToken.balanceOf.call(firstAddr));
    })

    it("should revert unstake if contract paused", async () => {
        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        await expectRevert(
            bRingFarming.unstake(stakeId, { from: firstAddr }),
            'Pausable: paused'
        );        
    })

    it("user should be able to do stake after unpause", async () => {
        await bRingFarming.unpause({ from: deployer });

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.stake(secondAddr, firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
    
        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        assert.equal(stakeDetails[0].length, 2, "user stake amount is wrong");
    })

    it("user should be able to claim reward after unpause", async () => {
        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        // check sum
    })

    it("user should be able unstake tokens", async () => {
        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.unstake(stakeId, { from: firstAddr });

        // check sum
    })
})