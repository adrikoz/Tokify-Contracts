const { expect } = require("chai");
var fs = require('fs');
const { ethers, waffle } = require("hardhat");

describe("Token contract", function () {
  // Mocha has four functions that let you hook into the the test runner's
  // lifecyle. These are: `before`, `beforeEach`, `after`, `afterEach`.

  // They're very useful to setup the environment for tests, and to clean it
  // up after they run.

  // A common pattern is to declare some variables, and assign them in the
  // `before` and `beforeEach` callbacks.

  let Token;
  let hardhatToken;
  let owner;
  let addr1;
  let addr2;
  let addrs;
  let tokenAddress;
  let pancakeContract;
  let busdContract;

  const deadWallet = '0x000000000000000000000000000000000000dEaD';
  const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

  var sellLiquidityTax = 400;
  var sellMarketingTax = 400;
  var sellDeveloperTax = 500;
  var sellTeamTax = 200;
  var totalSellTax = sellLiquidityTax + sellMarketingTax + sellDeveloperTax + sellTeamTax;

  var buyLiquidityTax = 200;
  var buyMarketingTax = 200;
  var buyDeveloperTax = 400;
  var buyTeamTax = 200;
  var totalBuyTax = buyLiquidityTax + buyMarketingTax + buyDeveloperTax + buyTeamTax;
  const feeDenominator = 10000;

  const marketingReceiver = '0xa83038843bd7F6e26e5a741095FA85038A54d68a';
  const contractGenerator = '0xF6bF36933149030ed4B212F0a79872306690e48e';
  const pancakeAddress = '0x10ed43c718714eb63d5aa57b78b54704e256024e';

  let marketingWallet;
  let generatorWallet;

  const provider = ethers.provider;

  decimals = 9;
  totalSupply = ethers.BigNumber.from("1000000000000000").mul(10 ** decimals);
  swapThreshold = totalSupply.div(4000);

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
      // Get the ContractFactory and Signers here.
      Token = await ethers.getContractFactory("EverGrow");
      [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

      marketingWallet = await ethers.getSigner(marketingReceiver);
      generatorWallet = await ethers.getSigner(contractGenerator);

      const { abi } = JSON.parse(fs.readFileSync("ABIs/pancakeswap.json"));
      pancakeContract = new ethers.Contract(pancakeAddress, abi, owner);

      // Set 1BNB to owner
      await network.provider.send("hardhat_setBalance", [
          owner.address,
          "0x8AC7230489E80000",
      ]);
    
    // Set 1BNB to address 3
      await network.provider.send("hardhat_setBalance", [
          addrs[0].address,
          "0x8AC7230489E80000",
      ]);
    
    await network.provider.send("hardhat_setBalance", [
          addrs[10].address,
          "0x0",
    ]);
    
    await network.provider.send("hardhat_setBalance", [
          addrs[11].address,
          "0x0",
    ]);
    
    await network.provider.send("hardhat_setBalance", [
          generatorWallet.address,
          "0x0",
      ]);

      // To deploy our contract, we just have to call Token.deploy() and await
      // for it to be deployed(), which happens once its transaction has been
      // mined.

      hardhatToken = await Token.deploy(pancakeAddress, marketingWallet.address, addrs[10].address, addrs[11].address);
      tokenAddress = hardhatToken.address
  });

  // You can nest describe calls to create subsections.
  describe("Deployment", function () {
      // `it` is another Mocha function. This is the one you use to define your
      // tests. It receives the test name, and a callback function.

      // If the callback function is async, Mocha will `await` it.
      it("Should set the right owner", async function () {
          // Expect receives a value, and wraps it in an Assertion object. These
          // objects have a lot of utility methods to assert values.

          // This test expects the owner variable stored in the contract to be equal
          // to our Signer's owner.
          expect(await hardhatToken.getOwner()).to.equal(owner.address);
      });

      it("Should assign the total supply of tokens to the owner", async function () {
          const ownerBalance = await hardhatToken.balanceOf(owner.address);
          expect(await hardhatToken.totalSupply()).to.equal(ownerBalance);
      });
  });

  describe("Transactions", function () {
      it("Should transfer tokens between accounts", async function () {
        // Transfer 50 tokens from owner to addr1
        await hardhatToken.transfer(addr1.address, 5000);
        var addr1Balance = await hardhatToken.balanceOf(addr1.address);
        expect(addr1Balance).to.equal(5000);

        // Transfer 50 tokens from addr1 to addr2
        // We use .connect(signer) to send a transaction from another account
        await hardhatToken.connect(addr1).transfer(addr2.address, 1000);
        var addr2Balance = await hardhatToken.balanceOf(addr2.address);
        expect(addr2Balance).to.equal(1000);

        // Transfer 50 tokens from addr1 to addr2
        // We use .connect(signer) to send a transaction from another account
        await hardhatToken.connect(addr2).transfer(addrs[0].address, 1000);
        var addrs0Balance = await hardhatToken.balanceOf(addrs[0].address);
        expect(addrs0Balance).to.equal(1000);

        // Transfer 50 tokens from addr1 to addr2
        // We use .connect(signer) to send a transaction from another account
        await hardhatToken.connect(addrs[0]).transfer(addrs[1].address, 1000);
        var addrs1Balance = await hardhatToken.balanceOf(addrs[1].address);
        expect(addrs1Balance).to.equal(1000);
      });

      it("Should fail if sender doesn’t have enough tokens", async function () {
            const initialOwnerBalance = await hardhatToken.balanceOf(owner.address);

            // Try to send 1 token from addr1 (0 tokens) to owner (1000000 tokens).
            // `require` will evaluate false and revert the transaction.
            await expect(
                hardhatToken.connect(addr1).transfer(owner.address, 1)
            ).to.be.revertedWith("Insufficient Balance");

            // Owner balance shouldn't have changed.
            expect(await hardhatToken.balanceOf(owner.address)).to.equal(
                initialOwnerBalance
            );
        });

        it("Should update balances after transfers", async function () {
            const initialOwnerBalance = await hardhatToken.balanceOf(owner.address);

            // Transfer 100 tokens from owner to addr1.
            await hardhatToken.transfer(addr1.address, 100);

            // Transfer another 50 tokens from owner to addr2.
            await hardhatToken.transfer(addr2.address, 50);

            // Check balances.
            const finalOwnerBalance = await hardhatToken.balanceOf(owner.address);
            expect(finalOwnerBalance).to.equal(initialOwnerBalance.sub(150));

            const addr1Balance = await hardhatToken.balanceOf(addr1.address);
            expect(addr1Balance).to.equal(100);

            const addr2Balance = await hardhatToken.balanceOf(addr2.address);
            expect(addr2Balance).to.equal(50);
        });

      it("Circulating supply calculation should not include burn wallet", async function () {
        // Transfer 50 tokens from owner to addr1
        await hardhatToken.transfer(addr1.address, 5000);
        var addr1Balance = await hardhatToken.balanceOf(addr1.address);
        expect(addr1Balance).to.equal(5000);

        // Transfer 50 tokens from addr1 to addr2
        // We use .connect(signer) to send a transaction from another account
        await hardhatToken.connect(addr1).transfer(addr2.address, 1000);
        var addr2Balance = await hardhatToken.balanceOf(addr2.address);
        expect(addr2Balance).to.equal(1000);

        await hardhatToken.connect(addr2).transfer(deadWallet, 500);
        const deadWalletBalance = await hardhatToken.balanceOf(deadWallet);
        expect(deadWalletBalance).to.equal(500);

        var contractBalance = await hardhatToken.balanceOf(tokenAddress);
        const finalOwnerBalance = await hardhatToken.balanceOf(owner.address);
        addr1Balance = await hardhatToken.balanceOf(addr1.address);
        addr2Balance = await hardhatToken.balanceOf(addr2.address);
        const circulatingSupply = await hardhatToken.getCirculatingSupply();
        expect(circulatingSupply).to.equal(contractBalance.add(finalOwnerBalance).add(addr1Balance).add(addr2Balance));
      });
  });

  describe.only("Taxes", function () {
    it("Transaction tax should go to contract address", async function () {
      console.log(0);
      await pancakeContract.addLiquidityETH(
            tokenAddress,
            ethers.BigNumber.from("800000000000000000000000"),
            0,
            ethers.BigNumber.from("800000000000000000"),
            owner.address,
            Date.now() + 100000,
            {value:"80000000000000000"}
      );
      console.log(1);
      // Transfer 50 tokens from owner to addr1
      await hardhatToken.transfer(addr1.address, 50000);
      var addr1Balance = await hardhatToken.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50000);

      // Transfer 50 tokens from addr1 to addr2
      // We use .connect(signer) to send a transaction from another account
      await hardhatToken.connect(addr1).transfer(addr2.address, 1000);
      var addr2Balance = await hardhatToken.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(1000);

      await pancakeContract.swapETHForExactTokens(
        ethers.BigNumber.from("1500000000000000000000"),
        [WBNB, tokenAddress],
        addrs[0].address,
        Date.now() + 100000,
        {value:"150000000000000000"}
      );

      await pancakeContract.swapETHForExactTokens(
        ethers.BigNumber.from("1500000000000000000000"),
        [WBNB, tokenAddress],
        addrs[0].address,
        Date.now() + 100000,
        {value:"150000000000000000"}
      );

      var addr3Balance = await hardhatToken.balanceOf(addrs[0].address);
      var contractBalance = await hardhatToken.balanceOf(hardhatToken.address);
      console.log(addr3Balance);
      console.log(contractBalance);
      var totalBalance = addr3Balance.add(contractBalance);
      expect(contractBalance).to.equal(totalBalance.mul(totalBuyTax).div(feeDenominator));      hardhatToken.setIsFeeExempt(owner.address, false);
      var ownerBalance = await hardhatToken.balanceOf(owner.address);
      await pancakeContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
          ethers.BigNumber.from("1500000000000000000000"),
          0,
          [tokenAddress, WBNB],
          owner.address,
          Date.now() + 100000
      );
      console.log('marketing: ', await provider.getBalance(marketingWallet.address));
      console.log('developer: ', await provider.getBalance(addrs[10].address));
      console.log('team: ', await provider.getBalance(addrs[11].address));
      console.log('generator: ', await provider.getBalance(generatorWallet.address));
      await pancakeContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
          ethers.BigNumber.from("1000000000000000000000"),
          0,
          [tokenAddress, WBNB],
          owner.address,
          Date.now() + 100000
      );
      var newOwnerBalance = await hardhatToken.balanceOf(owner.address);
      var ownerBalanceChange = ownerBalance.sub(newOwnerBalance);
      var newSellContractBalance = await hardhatToken.balanceOf(hardhatToken.address);
      var contractBalanceChange = newSellContractBalance.sub(contractBalance);
      console.log(contractBalanceChange);
      console.log(ownerBalanceChange)
      expect(contractBalanceChange.add(swapThreshold)).to.equal(ownerBalanceChange.mul(totalSellTax).div(feeDenominator));

      await network.provider.send("hardhat_setBalance", [
          addrs[10].address,
          "0x0",
    ]);
    
    await network.provider.send("hardhat_setBalance", [
          addrs[11].address,
          "0x0",
    ]);
    
    await network.provider.send("hardhat_setBalance", [
          generatorWallet.address,
          "0x0",
    ]);
      
      await network.provider.send("hardhat_setBalance", [
          marketingWallet.address,
          "0x0",
      ]);

      await hardhatToken.transfer(addr1.address, 50000);
      var newTransferContractBalance = await hardhatToken.balanceOf(hardhatToken.address);
      console.log(newTransferContractBalance);
      console.log('marketing: ', await provider.getBalance(marketingWallet.address));
      console.log('developer: ', await provider.getBalance(addrs[10].address));
      console.log('team: ', await provider.getBalance(addrs[11].address));
      console.log('generator: ', await provider.getBalance(generatorWallet.address));
      expect(newSellContractBalance.sub(swapThreshold)).to.equal(newTransferContractBalance);
      console.log('total buy fees:', await hardhatToken.storedBuyFees());
      console.log('total sell fees:', await hardhatToken.storedSellFees());
      expect((await hardhatToken.storedBuyFees()).add(await hardhatToken.storedSellFees())).to.equal(await hardhatToken.balanceOf(hardhatToken.address));

    });



    it("Excluded wallets should not be taxed", async function () {
        // Transfer 50 tokens from owner to addr1
        await hardhatToken.transfer(addr1.address, 50);
        var addr1Balance = await hardhatToken.balanceOf(addr1.address);
        expect(addr1Balance).to.equal(50);

        await hardhatToken.setIsFeeExempt(addr1.address, true);

        // Transfer 50 tokens from addr1 to addr2
        // We use .connect(signer) to send a transaction from another account
        await hardhatToken.connect(addr1).transfer(addr2.address, 50);
        const addr2Balance = await hardhatToken.balanceOf(addr2.address);
        addr1Balance = await hardhatToken.balanceOf(addr1.address);
        expect(addr2Balance).to.equal(50);
        expect(addr1Balance).to.equal(0);
    });

    it("Wallets taken off exclusion list should be taxed", async function () {
        await hardhatToken.setIsFeeExempt(owner.address, false);
        await hardhatToken.transfer(addr1.address, 50);
        const fee = parseInt(50 * (liquidityTax + reflectionTax + marketingTax) / feeDenominator);
        var addr1Balance = await hardhatToken.balanceOf(addr1.address);
        var ownerBalance = await hardhatToken.balanceOf(owner.address);
        expect(addr1Balance).to.equal(50 - fee);
        expect(ownerBalance).to.equal(totalSupply.sub(50));
    });

    it("Sell tax should depend on the sell multiplier", async function () {

    });

    it("Correct tax values need to be taken", async function () {

    });

    it("Tax value changes should be reflected in taxes taken", async function () {

    });
  });

  describe("Anti-bot and pause", function () {
      it.only("Transactions should not go through when pause activated", async function () {

        // Try to send 1 token from addr1 (0 tokens) to owner (1000000 tokens).
        // `require` will evaluate false and revert the transaction.
        await hardhatToken.transfer(addr1.address, 100);
        await hardhatToken.setPause(true);
        await expect(
            hardhatToken.connect(addr1).transfer(addr2.address, 10)
        ).to.be.revertedWith("WARNING: contract is in pause for maintenance");
        await hardhatToken.setPause(false);
        await hardhatToken.setFeeActive(false);
        await hardhatToken.connect(addr1).transfer(addr2.address, 10);
        expect(await hardhatToken.balanceOf(owner.address)).to.equal(totalSupply.sub(100));

        await hardhatToken.includeInAntiBot(addr1.address);
        await expect(
            hardhatToken.connect(addr1).transfer(owner.address, 10)
        ).to.be.revertedWith("WARNING: sending or recipient address is in blacklist, contact the team");
        await hardhatToken.excludeFromAntiBot(addr1.address);
        await hardhatToken.connect(addr1).transfer(owner.address, 10);
        expect(await hardhatToken.balanceOf(owner.address)).to.equal(totalSupply.sub(90));
        expect(await hardhatToken.balanceOf(addr2.address)).to.equal(10);
      });
    
  });
});