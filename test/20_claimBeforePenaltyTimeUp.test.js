const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");

const BRingToken = artifacts.require("bRingToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,
    time,
    constants,
    expectRevert
} = require('@openzeppelin/test-helpers');

contract("users make stake and claim before penalty duration time is up", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken, BRNGToken;
    let firstTokenAddress, secondTokenAddress, BRNGTokenAddress;

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
        const maxPenalty = new BN(30);
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
        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr];
        let userBalance;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        for(let i = 0; i < users.length; i++) {
            await firstToken.transfer(users[i], (new BN(stakeAmount)).mul(tokenbits), { from: deployer });
            userBalance = await firstToken.balanceOf.call(users[i]);
            assert.equal(userBalance.valueOf(), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user tokens balance is wrong`);
        }
    })

    it("users make stakes without referrer", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        let users = [firstAddr, secondAddr, thirdAddr, fourthAddr, fifthAddr];
        let stakeDetails;

        for(let i = 0; i < users.length; i++) {          
            await firstToken.approve(bRingFarmingAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });
            await bRingFarming.stake(users[i], firstTokenAddress, (new BN(stakeAmount)).mul(tokenbits), { from: users[i] });

            stakeDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });

            assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
            assert.equal(Number(stakeDetails[2]), Number((new BN(stakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
        }
    })

    it("first user make claim after stake in 1 day", async () => {
        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        await time.increase(time.duration.days(44));

        let stakeDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
        let stakeId = stakeDetails[0][0];

        let stakeRew = await bRingFarming.getStakeRewards(firstAddr, stakeId, { from: firstAddr });

        console.log("getStakeRewards:", (Number(stakeRew[0]) * 0.9) / tokenbits);
        expect((Number(stakeRew[0]) * 0.9)).to.be.above(0);
        
        await bRingFarming.claimReward(stakeId, { from: firstAddr });

        console.log(Number(await firstToken.balanceOf.call(firstAddr)) / tokenbits);
    })
})