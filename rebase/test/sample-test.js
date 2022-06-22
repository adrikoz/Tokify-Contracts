const { expect } = require("chai");
var fs = require('fs');
const { ethers } = require("hardhat");

describe("hardhatToken", function () {
  let Token;
  let hardhatToken;
  let owner;
  let addr1;
  let addr2;
  let addrs;
  let tokenAddress;
  let pancakeContract;

  const contractGenerator = '0xF6bF36933149030ed4B212F0a79872306690e48e';
  beforeEach(async function () {
    console.log('before');
    Token = await ethers.getContractFactory("TokifyRebase");
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    marketingWallet = addrs[10];
    generatorWallet = await ethers.getSigner(contractGenerator);

    const { abi } = JSON.parse(fs.readFileSync("ABIs/pancakeswap.json"));
    pancakeContract = new ethers.Contract('0x10ED43C718714eb63d5aA57B78B54704E256024E', abi, owner);

    hardhatToken = await Token.deploy('0x10ED43C718714eb63d5aA57B78B54704E256024E', '0xa83038843bd7F6e26e5a741095FA85038A54d68a', '0xa83038843bd7F6e26e5a741095FA85038A54d68a');
    await hardhatToken.deployed();
    tokenAddress = hardhatToken.address;

    await network.provider.send("hardhat_setBalance", [
            owner.address,
            "0x3635C9ADC5DEA00000",
        ]);
  });

  describe("Marketing and generator wallets", function () {
    it("Tax gets sent to marketing and generator wallets", async function () {
      console.log(await hardhatToken.balanceOf(owner.address));
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("1000000000000"),
                0,
                ethers.BigNumber.from("10000000"),
                owner.address,
                Date.now() + 100000,
                { value: "1000000000000" }
            );

            await hardhatToken.transfer(tokenAddress, swapThreshold.sub(1));
            var ownerBalance = await hardhatToken.balanceOf(owner.address);
            expect(ownerBalance).to.equal(totalSupply.sub(swapThreshold.sub(1)).sub(ethers.BigNumber.from("10000000000000000000000")));

            await hardhatToken.transfer(addr1.address, 50000);
            await hardhatToken.connect(addr1).transfer(addr2.address, 1000);

            var addr2Balance = await hardhatToken.balanceOf(addr2.address);
            const fee = parseInt(1000 * (liquidityTax + reflectionTax + marketingTax + backingTax) / feeDenominator);
            expect(addr2Balance).to.equal(1000 - fee);
            
            var contractBalance = await hardhatToken.balanceOf(tokenAddress);
            expect(contractBalance).to.equal(swapThreshold.sub(1).add(fee));

            const rewardsPoolAddress = await hardhatToken.getRewardsPool();

            const poolBalanceBefore = await hardhatToken.getBNBReserves();
            const marketingBalanceBefore = await provider.getBalance(addrs[10].address);
            const generatorBalanceBefore = await provider.getBalance(generatorWallet.address);
            const contractBNBBalanceBefore = await provider.getBalance(tokenAddress);

            await hardhatToken.connect(addr1).transfer(addr2.address, 1000);

            contractBalance = await hardhatToken.balanceOf(tokenAddress);
            expect(contractBalance).to.equal(2 * (fee) - 1);
            
            const rewardsBalance = await provider.getBalance(rewardsPoolAddress);
            const poolBalance = await hardhatToken.getBNBReserves();
            const generatorBalance = await provider.getBalance(generatorWallet.address);
            const marketingBalance = await provider.getBalance(addrs[10].address);
            const contractBNBBalance = await provider.getBalance(tokenAddress);

            console.log('rewards: ', rewardsBalance.sub(rewardsBalanceBefore));
            console.log('marketi: ', marketingBalance.sub(marketingBalanceBefore));
            console.log('generat: ', generatorBalance.sub(generatorBalanceBefore));

            expect((contractBNBBalance.sub(contractBNBBalanceBefore)).add(marketingBalance.sub(marketingBalanceBefore)).add(generatorBalance.sub(generatorBalanceBefore)).add(rewardsBalance.sub(rewardsBalanceBefore))).to.equal(poolBalanceBefore.sub(poolBalance));
        });
    });
  
});

