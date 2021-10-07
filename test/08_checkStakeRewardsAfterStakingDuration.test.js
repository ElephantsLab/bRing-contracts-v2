const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    time,
    constants
} = require('@openzeppelin/test-helpers');

contract("check if reward not bigger after stakingDuration", async accounts => {
    const [ deployer, firstAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, thirdToken;
    let firstTokenAddress, secondTokenAddress, thirdTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 1000000; // 1 000 000

    let stakeAmount = 10000;

    let firstTokenBalance90d, secondTokenBalance90d, thirdTokenBalance90d;
    let firstTokenBalance91d, secondTokenBalance91d, thirdTokenBalance91d;

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

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits),
                (new BN(tokenRewards[1])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[2])).mul(rewardsTokenbits)
            ],
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

    it("user should get revard after claim tokens after 90 days", async () => {
        let stakingDurationSeconds = Number(await bRingFarming.stakingDuration({ from: deployer }));
        await time.increase(time.duration.seconds(stakingDurationSeconds));

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId, { from: firstAddr });
        console.log("-------- after 90 days -----------");
        console.log("-------- getStakeRewards -----------");
        console.log(Number(stakeRew[0]));
        console.log(Number(stakeRew[1]));
        console.log(Number(stakeRew[2]));

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        
        firstTokenBalance90d = Number(await firstToken.balanceOf(firstAddr, { from: firstAddr }));
        secondTokenBalance90d = Number(await secondToken.balanceOf(firstAddr, { from: firstAddr }));
        thirdTokenBalance90d = Number(await thirdToken.balanceOf(firstAddr, { from: firstAddr }));

        console.log("-------- claimReward after 90 days -----------");
        console.log("-------- user balance -----------");
        console.log(firstTokenBalance90d);
        console.log(secondTokenBalance90d);
        console.log(thirdTokenBalance90d);

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        console.log("-------- claimReward after 90 days (2) -----------");
        console.log("-------- user balance -----------");
        console.log(firstTokenBalance90d);
        console.log(secondTokenBalance90d);
        console.log(thirdTokenBalance90d);

        expect(firstTokenBalance90d).to.be.above(0);
        expect(secondTokenBalance90d).to.be.above(0);       
        expect(thirdTokenBalance90d).to.be.above(0);
    })

    it("user should NOT get reward twice", async () => {
        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        assert.equal(Number(await firstToken.balanceOf(firstAddr, { from: firstAddr })), firstTokenBalance90d,
            "user firstToken balance after claimReward is wrong");
        assert.equal(Number(await secondToken.balanceOf(firstAddr, { from: firstAddr })), secondTokenBalance90d,
            "user secondToken balance after claimReward is wrong");
        assert.equal(Number(await thirdToken.balanceOf(firstAddr, { from: firstAddr })), thirdTokenBalance90d,
            "user thirdToken balance after claimReward is wrong");  
    })

    it("user should NOT get revard after claim tokens after 91 days", async () => {
        await time.increase(time.duration.days(1));

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId, { from: firstAddr });
        console.log("-------- after 91 days -----------");
        console.log("-------- getStakeRewards -----------");
        console.log(Number(stakeRew[0]));
        console.log(Number(stakeRew[1]));
        console.log(Number(stakeRew[2]));

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        console.log("-------- claimReward after 91 days -----------");
        console.log("-------- user balance -----------");
        firstTokenBalance91d = Number(await firstToken.balanceOf(firstAddr, { from: firstAddr }));
        secondTokenBalance91d = Number(await secondToken.balanceOf(firstAddr, { from: firstAddr }));
        thirdTokenBalance91d = Number(await thirdToken.balanceOf(firstAddr, { from: firstAddr }));
        console.log(firstTokenBalance91d);
        console.log(secondTokenBalance91d);
        console.log(thirdTokenBalance91d);

    })

})