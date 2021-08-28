const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");
const ThirdToken = artifacts.require("ThirdToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

contract("test", async accounts => {
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
        await bRingFarming.configPool(firstTokenAddress, minStakeAmount, maxStakeAmount, totalStakeLimit,
            [firstTokenAddress, secondTokenAddress, thirdTokenAddress], [1 * 10^18, 2 * 10^18, 3 * 10^18])
    })

    it("send tokens to the contract address", async () => {
        let tokenContractBalance;
        let tokensNames = [firstToken, secondToken, thirdToken];

        for(let i = 0; i < tokensNames.length; i++){
            await tokensNames[i].transfer(bRingFarmingAddress, maxStakeAmount, { from: deployer });
            tokenContractBalance = await tokensNames[i].balanceOf.call(bRingFarmingAddress);
            assert.equal(tokenContractBalance.valueOf(), maxStakeAmount, `contract ${tokensNames[i]} balance is wrong`);
        }
    })

    it("user address should have firstToken in his address", async () => {
        await firstToken.transfer(firstAddr, (stakeAmount * 2), { from: deployer });
        let firstUserBalance = await firstToken.balanceOf.call(firstAddr);
        assert.equal(firstUserBalance.valueOf(), (stakeAmount * 2), "user tokens balance is wrong");
    })

    it("user makes first stake", async () => {
        await firstToken.approve(bRingFarmingAddress, stakeAmount, { from: firstAddr });
        await bRingFarming.stake(secondAddr, firstTokenAddress, stakeAmount, { from: firstAddr });
    
    })

    it("user makes second stake", async () => {
        await firstToken.approve(bRingFarmingAddress, (stakeAmount - 100), { from: firstAddr });
        await bRingFarming.stake(secondAddr, firstTokenAddress, (stakeAmount - 100), { from: firstAddr });
     
    })

    // it("claim reward", async () => {
    //     // await time.increase(time.duration.minutes(59));

    //     // await bRingFarming.claimReward()

    //     let userStakingDetails = await bRingFarming.viewStakingDetails(firstAddr, { from: firstAddr });
    //     console.log(userStakingDetails[0]);
    // })
})