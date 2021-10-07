const FirstToken = artifacts.require("FirstToken");
const SecondToken = artifacts.require("SecondToken");

const bRingFarmingContract = artifacts.require("BRingFarming");

const {
    BN,           // Big Number support
    time,
    constants
} = require('@openzeppelin/test-helpers');

contract("check zero totalStakeLimit param", async accounts => {
    const [ deployer, firstAddr, secondAddr, thirdAddr ] = accounts;

    let bRingFarming;
    let bRingFarmingAddress;

    let firstToken, secondToken;
    let firstTokenAddress, secondTokenAddress;

    let minStakeAmount = 1;
    let maxStakeAmount = 500000; // 500 000
    let totalStakeLimit = 0;

    // let stakeAmount = 1000;

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

        await bRingFarming.configPool(firstTokenAddress, (new BN(minStakeAmount)).mul(tokenbits), 
            (new BN(maxStakeAmount)).mul(tokenbits), (new BN(totalStakeLimit)).mul(tokenbits),
            [firstTokenAddress, secondTokenAddress], 
            [
                (new BN(tokenRewards[0])).mul(rewardsTokenbits), 
                (new BN(tokenRewards[1])).mul(rewardsTokenbits)
            ],
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
        let users = [firstAddr, secondAddr, thirdAddr];
        let userBalance;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        for(let i = 0; i < users.length; i++) {
            await firstToken.transfer(users[i], (new BN(maxStakeAmount)).mul(tokenbits), { from: deployer });
            userBalance = await firstToken.balanceOf.call(users[i]);
            assert.equal(userBalance.valueOf(), Number((new BN(maxStakeAmount)).mul(tokenbits)), `${users[i]} user tokens balance is wrong`);
        }
    })

    it("users make stake without referrer", async () => {
        let users = [firstAddr, secondAddr, thirdAddr];
        let stakeDetails;

        const decimals = await firstToken.decimals();
        const tokenbits = (new BN(10)).pow(decimals);

        for(let i = 0; i < users.length; i++){
            await firstToken.approve(bRingFarmingAddress, (new BN(maxStakeAmount)).mul(tokenbits), { from: users[i] });
            await bRingFarming.stake(users[i], firstTokenAddress, (new BN(maxStakeAmount)).mul(tokenbits), { from: users[i] });

            stakeDetails = await bRingFarming.viewStakingDetails(users[i], { from: users[i] });

            assert.equal(stakeDetails[0].length, 1, `${users[i]} user number of stake is wrong`);
            assert.equal(Number(stakeDetails[2]), Number((new BN(maxStakeAmount)).mul(tokenbits)), `${users[i]} user stake amount is wrong`);
        }
    })
})