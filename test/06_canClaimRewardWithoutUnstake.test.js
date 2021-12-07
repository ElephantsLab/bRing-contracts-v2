const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    time,
    constants
} = require('@openzeppelin/test-helpers');

contract("user should be able claim reward without unstake", async accounts => {
    const [ deployer, firstAddr, secondAddr ] = accounts;

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
        const decimals = await secondToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);
        let tokenRewards = [1, 2, 3];

        const maxPenalty = new BN(0);
        const penaltyDuration = 45 * 24 * 3600;

        await bRingFarming.configPool(secondTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress, thirdTokenAddress], 
            [(new BN(tokenRewards[0])).mul(tokenbits), (new BN(tokenRewards[1])).mul(tokenbits), (new BN(tokenRewards[2])).mul(tokenbits)],
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

    it("users should have secondToken in their addresses", async () => {
        let users = [ firstAddr, secondAddr ];
        let userBalance;

        const decimals = await secondToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        for(let i = 0; i < users.length; i++) {
            await secondToken.transfer(users[i], (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
            userBalance = await secondToken.balanceOf.call(users[i]);
            assert.equal(userBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user tokens balance is wrong`);
        }
    })

    it("second user makes stake ", async () => {
        const decimals = await secondToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await secondToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: secondAddr });
        await bRingFarming.methods['stake(address,address,uint256)'](secondAddr, secondTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: secondAddr });
    
        let stakeDetails = await bRingFarming.viewStakingDetails(secondAddr, 0, 0, { from: secondAddr });
        assert.equal(stakeDetails[0].length, 1, "second user stake amount is wrong");
    })

    it("first user makes stake", async () => {
        const decimals = await secondToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await secondToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
        await bRingFarming.methods['stake(address,address,uint256)'](secondAddr, secondTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: firstAddr });
    
        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, 0, 0, { from: firstAddr });
        assert.equal(stakeDetails[0].length, 1, "first user stake amount is wrong");
    })

    it("user should be able view stake reward", async () => {
        await time.increase(time.duration.days(1));

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, 0, 0, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId, { from: firstAddr });
        
        console.log("firstToken getStakeRewards * 94% = ", (Number(stakeRew[0]) * 0.94));
        console.log("secondToken getStakeRewards * 94% = ", (Number(stakeRew[1]) * 0.94));
        console.log("thirdToken getStakeRewards * 94% = ", (Number(stakeRew[2]) * 0.94));

        expect(Number(stakeRew[0])).to.be.above(0);
        expect(Number(stakeRew[1])).to.be.above(0);
        expect(Number(stakeRew[2])).to.be.above(0);

    })

    it("user should be able claim reward without unstake", async () => {
        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, 0, 0, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        console.log("claim firstToken", Number(await firstToken.balanceOf.call(firstAddr)));
        console.log("claim secondToken", Number(await secondToken.balanceOf.call(firstAddr)));
        console.log("claim thirdToken", Number(await thirdToken.balanceOf.call(firstAddr)));

        expect(Number(await secondToken.balanceOf.call(firstAddr))).to.be.above(0);
        expect(Number(await firstToken.balanceOf.call(firstAddr))).to.be.above(0);
        expect(Number(await thirdToken.balanceOf.call(firstAddr))).to.be.above(0);
    })
})