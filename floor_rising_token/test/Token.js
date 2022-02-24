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

    const liquidityTax = 200;
    const reflectionTax = 200;
    const backingTax = 200;
    const marketingTax = 200;
    const feeDenominator = 10000;

    const buyMultiplier = 10000;
    const sellMultiplier = 10000;

    const marketingReceiver = '0xa83038843bd7F6e26e5a741095FA85038A54d68a';
    const contractGenerator = '0xF6bF36933149030ed4B212F0a79872306690e48e';

    let marketingWallet;
    let generatorWallet;

    const provider = ethers.provider;

    decimals = 9;
    totalSupply = ethers.BigNumber.from("1000000000000000").mul(10 ** decimals);
    swapThreshold = totalSupply.div(2000);

    // `beforeEach` will run before each test, re-deploying the contract every
    // time. It receives a callback, which can be async.
    beforeEach(async function () {
        // Get the ContractFactory and Signers here.
        Token = await ethers.getContractFactory("TokifyRisingFloor");
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        marketingWallet = addrs[10];
        generatorWallet = await ethers.getSigner(contractGenerator);

        const { abi } = JSON.parse(fs.readFileSync("ABIs/pancakeswap.json"));
        pancakeContract = new ethers.Contract('0x10ed43c718714eb63d5aa57b78b54704e256024e', abi, owner);

        const { abiBUSD } = JSON.parse(fs.readFileSync("ABIs/busd.json"));
        busdContract = new ethers.Contract('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', abiBUSD, owner);

        // Set 1BNB to owner
        await network.provider.send("hardhat_setBalance", [
            owner.address,
            "0x3635C9ADC5DEA00000",
        ]);

        // To deploy our contract, we just have to call Token.deploy() and await
        // for it to be deployed(), which happens once its transaction has been
        // mined.

        hardhatToken = await Token.deploy(pancakeContract.address, addrs[10].address, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');

        tokenAddress = hardhatToken.address
        
        await owner.sendTransaction({
            to: tokenAddress,
            value: ethers.utils.parseEther("1.0"), // Sends exactly 1.0 ether
        });
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
            await hardhatToken.transfer(addr1.address, 50);
            const addr1Balance = await hardhatToken.balanceOf(addr1.address);
            expect(addr1Balance).to.equal(50);

            // Transfer 50 tokens from addr1 to addr2
            // We use .connect(signer) to send a transaction from another account
            await hardhatToken.connect(addr1).transfer(addr2.address, 50);
            const addr2Balance = await hardhatToken.balanceOf(addr2.address);
            const fee = parseInt(50 * (liquidityTax + reflectionTax + backingTax + marketingTax) / feeDenominator);
            expect(addr2Balance).to.equal(50 - fee);
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
            const fee = parseInt(1000 * (liquidityTax + reflectionTax + backingTax + marketingTax) / feeDenominator);
            expect(addr2Balance).to.equal(1000 - fee);

            await hardhatToken.connect(addr2).transfer(deadWallet, 500);
            const deadWalletBalance = await hardhatToken.balanceOf(deadWallet);
            expect(deadWalletBalance).to.equal(500);

            const contractBalance = await hardhatToken.balanceOf(tokenAddress);
            const finalOwnerBalance = await hardhatToken.balanceOf(owner.address);
            addr1Balance = await hardhatToken.balanceOf(addr1.address);
            addr2Balance = await hardhatToken.balanceOf(addr2.address);
            const circulatingSupply = await hardhatToken.getCirculatingSupply();
            expect(circulatingSupply).to.equal(contractBalance.add(finalOwnerBalance).add(addr1Balance).add(addr2Balance));
        });
    });

    describe("Taxes", function () {
        it("Transaction tax should go to contract address", async function () {
            // Transfer 50 tokens from owner to addr1
            await hardhatToken.transfer(addr1.address, 50000);
            var addr1Balance = await hardhatToken.balanceOf(addr1.address);
            expect(addr1Balance).to.equal(50000);

            // Transfer 50 tokens from addr1 to addr2
            // We use .connect(signer) to send a transaction from another account
            await hardhatToken.connect(addr1).transfer(addr2.address, 1000);
            var addr2Balance = await hardhatToken.balanceOf(addr2.address);
            const fee = parseInt(1000 * (liquidityTax + reflectionTax + backingTax + marketingTax) / feeDenominator);
            expect(addr2Balance).to.equal(1000 - fee);

            await hardhatToken.connect(addr2).transfer(addrs[0].address, 500);
            var addr3Balance = await hardhatToken.balanceOf(addrs[0].address);
            const fee2 = parseInt(500 * (liquidityTax + reflectionTax + backingTax + marketingTax) / feeDenominator);
            expect(addr3Balance).to.equal(500 - fee2);

            const contractBalance = await hardhatToken.balanceOf(tokenAddress);
            expect(contractBalance).to.equal(fee + fee2);
        });

        it("Transaction tax should be distributed at threshold", async function () {

            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("100000000000000000000000"),
                0,
                ethers.BigNumber.from("100000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "10000000000000000" }
            );

            await hardhatToken.transfer(tokenAddress, swapThreshold.sub(1));
            var ownerBalance = await hardhatToken.balanceOf(owner.address);
            expect(ownerBalance).to.equal(totalSupply.sub(swapThreshold.sub(1)).sub(ethers.BigNumber.from("100000000000000000000000")));

            await hardhatToken.transfer(addr1.address, 50000);
            await hardhatToken.connect(addr1).transfer(addr2.address, 1000);

            var addr2Balance = await hardhatToken.balanceOf(addr2.address);
            const fee = parseInt(1000 * (liquidityTax + reflectionTax + backingTax + marketingTax) / feeDenominator);
            expect(addr2Balance).to.equal(1000 - fee);
            
            var contractBalance = await hardhatToken.balanceOf(tokenAddress);
            expect(contractBalance).to.equal(swapThreshold.sub(1).add(fee));

            const oldContractBalance = await provider.getBalance(hardhatToken.address);
            const oldMarketingBalance = await provider.getBalance(addrs[10].address);
            const oldBNBResevers = await hardhatToken.getBNBReserves();

            await hardhatToken.connect(addr1).transfer(addr2.address, 1000);

            contractBalance = await hardhatToken.balanceOf(tokenAddress);

            const rewardsPoolAddress = await hardhatToken.getRewardsPool();
            const dividendDistributorAddress = await hardhatToken.getDividendDistributor();


            console.log('backing: ', (await provider.getBalance(hardhatToken.address)).sub(oldContractBalance));
            console.log('marketing: ', (await provider.getBalance(addrs[10].address)).sub(oldMarketingBalance));
            console.log('generator: ', await provider.getBalance(generatorWallet.address));
            console.log('rewards: ', await provider.getBalance(rewardsPoolAddress));
            console.log('dividend: ', await provider.getBalance(dividendDistributorAddress));
            console.log('liquidity: ', (await hardhatToken.getBNBReserves()).sub(oldBNBResevers));

            expect(contractBalance).to.equal(2 * (fee) - 1);
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
            const fee = parseInt(50 * (liquidityTax + reflectionTax + marketingTax + backingTax) / feeDenominator);
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

    describe("Burn for BNB", function () {
        it("Burn for BNB function call should return a proportional amount of circulating supply BNB to caller", async function () {
            const rewardsPoolAddress = await hardhatToken.getRewardsPool();
            await owner.sendTransaction({
                to: rewardsPoolAddress,
                value: ethers.utils.parseEther("4.0"), // Sends exactly 1.0 ether
            });
            
            const ownerBalanceBefore = await provider.getBalance(owner.address);
            await hardhatToken.burnForBNB(ethers.BigNumber.from('100000000000000000000000'));
            const ownerBalance = await provider.getBalance(owner.address);
            const contractBNBBalance = await provider.getBalance(hardhatToken.address);
            console.log(contractBNBBalance);
            console.log(await provider.getBalance(await hardhatToken.getRewardsPool()));

            console.log(ownerBalance.sub(ownerBalanceBefore));
            console.log(await hardhatToken.getCirculatingSupply());

            await expect(hardhatToken.connect(addr1).transfer(addr2.address, 1000)).to.be.revertedWith("Insufficient Balance");;

        });

        it("Sending to dEaD wallet should return a proportional amount of circulating supply BNB to caller", async function () {

        });

        it("Calling burn for BNB with insufficient balance should result in error", async function () {

        });

        it("Calling burn for BNB twice before first function executed should result in one error", async function () {

        });
    });

    /*describe("Underflow and overflow Attacks", function () {

    });*/

    describe("Distribute Rewards", function () {
        beforeEach(async function () {
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("10000000000000000000000"),
                0,
                ethers.BigNumber.from("1000000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "1000000000000000000" }
            );

            await hardhatToken.transfer(tokenAddress, swapThreshold.sub(1));
            var ownerBalance = await hardhatToken.balanceOf(owner.address);
            expect(ownerBalance).to.equal(totalSupply.sub(swapThreshold.sub(1)).sub(ethers.BigNumber.from("10000000000000000000000")));

            await hardhatToken.transfer(addr1.address, 50000);
            await hardhatToken.connect(addr1).transfer(addr2.address, 1000);
            // Trigger a threshold hit event
            await hardhatToken.connect(addr1).transfer(addrs[0].address, 1000);

        });
        it("Rewards moved from rewards pool to distributor", async function () {
            const rewardsPoolAddress = await hardhatToken.getRewardsPool();
            const rewardsBalanceBefore = await provider.getBalance(rewardsPoolAddress);
            const dividendDistributorAddress = await hardhatToken.getDividendDistributor();
            const dividendDistributorBalanceBefore = await busdContract.balanceOf(dividendDistributorAddress);
            console.log(dividendDistributorBalanceBefore);

            expect(dividendDistributorBalanceBefore).to.equal(0);

            await hardhatToken.payoutFractionOfRewardsPool(8, 10);
            
            const rewardsBalance = await provider.getBalance(rewardsPoolAddress);
            const dividendDistributorBalance = await busdContract.balanceOf(dividendDistributorAddress);
            console.log(dividendDistributorBalance);
            console.log(rewardsBalanceBefore);
            console.log(rewardsBalance);
            const toTransfer = rewardsBalanceBefore.mul(8).div(10);
            expect(rewardsBalance).to.equal(rewardsBalanceBefore.sub(toTransfer));
            expect(dividendDistributorBalance).to.not.equal(0);
        });

        it("All rewards distributed from distributor to current holders", async function () {


            for (let i = 0; i < addrs.length; i++) {
                await hardhatToken.connect(addr1).transfer(addrs[i].address, 1000);
            }

            await hardhatToken.setIsDividendExempt(owner.address, true);
            const dividendDistributorAddress = await hardhatToken.getDividendDistributor();
            const rewardsPoolAddress = await hardhatToken.getRewardsPool();
            const dividendDistributorBalanceBefore = await busdContract.balanceOf(dividendDistributorAddress);
            console.log(dividendDistributorBalanceBefore);
            const rewardsBalance = await provider.getBalance(rewardsPoolAddress);
            console.log(rewardsBalance);

            expect(dividendDistributorBalanceBefore).to.equal(0);

            await hardhatToken.payoutFractionOfRewardsPool(8, 10);

            

            const distributorBalanceBefore = await hardhatToken.getDistributorPoolBalance();
            const randomAddressBalanceBefore = await busdContract.balanceOf(addrs[9].address);
            const ownerBalanceBefore = await busdContract.balanceOf(owner.address);

            console.log(distributorBalanceBefore);
            console.log(randomAddressBalanceBefore);
            console.log(ownerBalanceBefore);
        
            await hardhatToken.connect(addr1).transfer(addrs[1].address, 1000);
            await hardhatToken.connect(addr1).transfer(addrs[1].address, 1000);
            await hardhatToken.connect(addr1).transfer(addrs[1].address, 1000);

            const randomAddressBalance = await busdContract.balanceOf(addrs[9].address);
            const distributorBalance = await hardhatToken.getDistributorPoolBalance();
            const ownerBalance = await busdContract.balanceOf(owner.address);

            console.log(distributorBalance);
            console.log(randomAddressBalance);
            console.log(ownerBalance);

            expect(distributorBalance.toNumber()).to.be.lessThan(100);

        });

        it("Reward distribution stops after all rewards have been distributed and starts again when distributor receives more BNB", async function () {

        });

        it("Excluded wallets should not receive dividend", async function () {
        
        });

        it("Wallets that gain extra token between reward periods should not receive BNB from old reward period", async function () {
        
        });
    });

    describe("Variable gap ratio tax rates", function () {
        it("Gap ratio tier 1 at bottom of tier", async function () {
            // Send 0.1BNB to pancakeswap for 10% of supply
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("100000000000000000000000"),
                0,
                ethers.BigNumber.from("100000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "100000000000000000" }
            );
            const gapRatio = (await hardhatToken.getCurrentGapRatio(10000)).div(10000);

            expect(gapRatio).to.equal(1);
            
            const sellMultipliedFee = await hardhatToken.getSellMultipliedFee();
            const fee = parseInt(gapRatio * (liquidityTax + reflectionTax + marketingTax + backingTax));
            expect(fee).to.equal(sellMultipliedFee);
        });

        it("Gap ratio is 3", async function () {
            // Send 0.3BNB to pancakeswap for 10% of supply
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("100000000000000000000000"),
                0,
                ethers.BigNumber.from("300000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "300000000000000000" }
            );
            const gapRatio = (await hardhatToken.getCurrentGapRatio(10000)).div(10000);

            expect(gapRatio).to.equal(3);
            
            const sellMultipliedFee = await hardhatToken.getSellMultipliedFee();
            const fee = parseInt(gapRatio * (liquidityTax + reflectionTax + marketingTax + backingTax));
            expect(fee).to.equal(sellMultipliedFee);
        });

        it("Gap ratio smaller than 1", async function () {
            // Send 0.3BNB to pancakeswap for 10% of supply
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("100000000000000000000000"),
                0,
                ethers.BigNumber.from("30000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "30000000000000000" }
            );
            const gapRatio = (await hardhatToken.getCurrentGapRatio(10000));

            expect(gapRatio / 10000).to.equal(0.3);
            
            const sellMultipliedFee = await hardhatToken.getSellMultipliedFee();
            const fee = liquidityTax + reflectionTax + marketingTax + backingTax;
            expect(fee).to.equal(sellMultipliedFee);
        });

        it("Gap ratio greater than 5", async function () {
            // Send 0.3BNB to pancakeswap for 10% of supply
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("100000000000000000000000"),
                0,
                ethers.BigNumber.from("600000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "600000000000000000" }
            );
            const gapRatio = (await hardhatToken.getCurrentGapRatio(10000)).div(10000);

            expect(gapRatio).to.equal(6);
            
            const sellMultipliedFee = await hardhatToken.getSellMultipliedFee();
            const fee = 5 * (liquidityTax + reflectionTax + marketingTax + backingTax);
            expect(fee).to.equal(sellMultipliedFee);
        });

        it("variable tax set on selling but not buying", async function () {
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("100000000000000000000000"),
                0,
                ethers.BigNumber.from("600000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "600000000000000000" }
            );

            await hardhatToken.setIsFeeExempt(owner.address, false);
            
            await pancakeContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
                ethers.BigNumber.from("100000000000000000000"),
                0,
                [tokenAddress, WBNB],
                owner.address,
                Date.now() + 100000
            );
            const fee = 5 * (liquidityTax + reflectionTax + marketingTax + backingTax);

            const routerReceive = ethers.BigNumber.from("100000000000000000000").sub(ethers.BigNumber.from("100000000000000000000").mul(fee).div(10000));
            const routerBalance = ethers.BigNumber.from("100000000000000000000000").add(routerReceive);
            const pancakeBalance = await hardhatToken.getReservesToken();
            expect(routerBalance).to.equal(pancakeBalance);

            const ownerBalanceBefore = await hardhatToken.balanceOf(owner.address);
            await pancakeContract.swapExactETHForTokensSupportingFeeOnTransferTokens(
                0,
                [WBNB, tokenAddress],
                owner.address,
                Date.now() + 100000,
                { value: "10000000000000000" }
            );
            const pancakeBalance2 = await hardhatToken.getReservesToken();
            const pancakeSent = pancakeBalance.sub(pancakeBalance2);
            const feeTaken = pancakeSent.mul(liquidityTax + reflectionTax + marketingTax + backingTax).div(feeDenominator);
            const ownerBalanceFinal = await hardhatToken.balanceOf(owner.address);

            expect(ownerBalanceFinal.sub(ownerBalanceBefore)).to.equal(pancakeSent.sub(feeTaken));
        });

        it("contract returns current tax rate", async function () {
        
        });
    });

    describe("Marketing and generator wallets", function () {
        it("Tax gets sent to marketing and generator wallets", async function () {
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("10000000000000000000000"),
                0,
                ethers.BigNumber.from("1000000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "1000000000000000000" }
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

            const rewardsBalanceBefore = await provider.getBalance(rewardsPoolAddress);
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

    describe("Sell tax changed", function () {
        it("Testing hardcap", async function () {
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("100000000000000000000000"),
                0,
                ethers.BigNumber.from("800000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "800000000000000000" }
            );
            await expect(hardhatToken.setMaxSellFeeDenominator10000(6000)).to.be.revertedWith("Value too high");
            await expect(hardhatToken.setMaxSellFeeDenominator10000(600)).to.be.revertedWith("Value too low");
            await hardhatToken.setFeesWithDenominator10000(500, 500, 500, 500);
            await expect(hardhatToken.setMaxSellFeeDenominator10000(1999)).to.be.revertedWith("Value too low");
            await hardhatToken.setMaxSellFeeDenominator10000(4000);
            await hardhatToken.setFeesWithDenominator10000(liquidityTax, reflectionTax, marketingTax, backingTax);
            await hardhatToken.setMaxSellFeeDenominator10000(800);
            await hardhatToken.setFeesWithDenominator10000(500, 500, 500, 500);
            // Send 0.3BNB to pancakeswap for 10% of supply
            await hardhatToken.setIsFeeExempt(owner.address, false);
            const gapRatio = (await hardhatToken.getCurrentGapRatio(10000)).div(10000);

            expect(gapRatio).to.equal(8);
            
            const sellMultipliedFee = await hardhatToken.getSellMultipliedFee();
            const fee = parseInt(gapRatio * (liquidityTax + reflectionTax + marketingTax + backingTax));
            expect(sellMultipliedFee).to.equal(2000);
        });

        it("Testing multiplier", async function () {
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("100000000000000000000000"),
                0,
                ethers.BigNumber.from("800000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "800000000000000000" }
            );
            await expect(hardhatToken.setMaxSellMultiplierDenominator10000(100001)).to.be.revertedWith("Value too high");
            await expect(hardhatToken.setMaxSellMultiplierDenominator10000(9999)).to.be.revertedWith("Value too low");
            await hardhatToken.setMaxSellMultiplierDenominator10000(40000);
            await hardhatToken.setFeesWithDenominator10000(liquidityTax, reflectionTax, marketingTax, backingTax);
            await hardhatToken.setFeesWithDenominator10000(500, 500, 500, 500);
            // Send 0.3BNB to pancakeswap for 10% of supply
            await hardhatToken.setIsFeeExempt(owner.address, false);
            const gapRatio = (await hardhatToken.getCurrentGapRatio(10000)).div(10000);

            expect(gapRatio).to.equal(8);
            
            var sellMultipliedFee = await hardhatToken.getSellMultipliedFee();
            const fee = parseInt(gapRatio * (liquidityTax + reflectionTax + marketingTax + backingTax));
            expect(sellMultipliedFee).to.equal(5000);
            await hardhatToken.setFeesWithDenominator10000(250, 250, 250, 250);
            sellMultipliedFee = await hardhatToken.getSellMultipliedFee();
            expect(sellMultipliedFee).to.equal(4000);
        });

        it("Changing dividend token", async function () {
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("100000000000000000000000"),
                0,
                ethers.BigNumber.from("100000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "100000000000000000" }
            );
            await expect(hardhatToken.setMaxSellMultiplierDenominator10000(100001)).to.be.revertedWith("Value too high");
            await expect(hardhatToken.setMaxSellMultiplierDenominator10000(9999)).to.be.revertedWith("Value too low");
            await hardhatToken.setMaxSellMultiplierDenominator10000(40000);
            await hardhatToken.setFeesWithDenominator10000(liquidityTax, reflectionTax, marketingTax, backingTax);
            await hardhatToken.setFeesWithDenominator10000(500, 500, 500, 500);
            // Send 0.3BNB to pancakeswap for 10% of supply
            await hardhatToken.setIsFeeExempt(owner.address, false);
            const gapRatio = (await hardhatToken.getCurrentGapRatio(10000)).div(10000);

            expect(gapRatio).to.equal(8);
            
            var sellMultipliedFee = await hardhatToken.getSellMultipliedFee();
            const fee = parseInt(gapRatio * (liquidityTax + reflectionTax + marketingTax + backingTax));
            expect(sellMultipliedFee).to.equal(5000);
            await hardhatToken.setFeesWithDenominator10000(250, 250, 250, 250);
            sellMultipliedFee = await hardhatToken.getSellMultipliedFee();
            expect(sellMultipliedFee).to.equal(4000);
        });

        it("Rewards token can be changed", async function () {
            await pancakeContract.addLiquidityETH(
                tokenAddress,
                ethers.BigNumber.from("10000000000000000000000"),
                0,
                ethers.BigNumber.from("1000000000000000000"),
                owner.address,
                Date.now() + 100000,
                { value: "1000000000000000000" }
            );

            await hardhatToken.transfer(tokenAddress, swapThreshold.sub(1));
            console.log(await hardhatToken.baseTaxesAccumulated());
            var ownerBalance = await hardhatToken.balanceOf(owner.address);
            expect(ownerBalance).to.equal(totalSupply.sub(swapThreshold.sub(1)).sub(ethers.BigNumber.from("10000000000000000000000")));

            await hardhatToken.transfer(addr1.address, 50000);
            await hardhatToken.connect(addr1).transfer(addr2.address, 1000);
            // Trigger a threshold hit event
            await hardhatToken.connect(addr1).transfer(addrs[0].address, 1000);

            for (let i = 0; i < addrs.length; i++) {
                await hardhatToken.connect(addr1).transfer(addrs[i].address, 1000);
            }

            expect(await hardhatToken.getDividendTokenAddress()).to.equal('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');

            await hardhatToken.setIsDividendExempt(owner.address, true);
            const dividendDistributorBalanceBefore = await hardhatToken.getDistributorPoolBalance();

            console.log(1);
            await hardhatToken.setDividendToken(busdContract.address);
            console.log(2);

            expect(dividendDistributorBalanceBefore).to.equal(0);

            console.log(3);
            await network.provider.send("hardhat_setBalance", [
                owner.address,
                "0x3635C9ADC5DEA00000",
            ]);
            await hardhatToken.payoutFractionOfRewardsPool(8, 10);
            console.log(4);

            const distributorBalanceBefore = await hardhatToken.getDistributorPoolBalance();
            const randomAddressBalanceBefore = await busdContract.balanceOf(addrs[9].address);
            const ownerBalanceBefore = await busdContract.balanceOf(owner.address);

            console.log(distributorBalanceBefore);
            console.log(randomAddressBalanceBefore);
            console.log(ownerBalanceBefore);
        
            await hardhatToken.connect(addr1).transfer(addrs[1].address, 1000);
            expect(await hardhatToken.setDividendToken('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c')).to.be.revertedWith('Cannot change dividend token after the first distribution has started');
            await hardhatToken.connect(addr1).transfer(addrs[1].address, 1000);
            await hardhatToken.connect(addr1).transfer(addrs[1].address, 1000);

            const randomAddressBalance = await busdContract.balanceOf(addrs[9].address);
            const distributorBalance = await hardhatToken.getDistributorPoolBalance();
            ownerBalance = await busdContract.balanceOf(owner.address);

            expect(await hardhatToken.setDividendToken('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c')).to.be.revertedWith('Cannot change dividend token after the first distribution has started');

            console.log(distributorBalance);
            console.log(randomAddressBalance);
            console.log(ownerBalance);

            expect(distributorBalance.toNumber()).to.be.lessThan(100);

        });
    });
    describe("asset pool unlocked after certain time", function () {
        it.only("Locking asset pool", async function () {
            hardhatToken.lockAssetRewardPools(2);
            console.log(1);
            await expect (hardhatToken.moveAssetPool(owner.address)).to.be.revertedWith("Asset pool currently locked");
            
            await network.provider.send("evm_increaseTime", [3600 * 49]);
            console.log(2);
            await network.provider.send("evm_mine") // this one will have 02:00 PM as its timestamp
            console.log(3);
            await hardhatToken.moveAssetPool(owner.address);
            expect(await provider.getBalance(hardhatToken.address)).to.equal(0);
        });
    });
});