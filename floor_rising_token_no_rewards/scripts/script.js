const hre = require("hardhat");
var fs = require('fs');
const ethers = hre.ethers;

async function main() {
    Token = await ethers.getContractFactory("redditspace");
    addresses = await ethers.getSigners();

    const { abi } = JSON.parse(fs.readFileSync("ABIs/pancakeswap.json"));
    pancakeContract = new ethers.Contract(
      "0x3Ef391dF0756Cb8da62856eFBb385aaC1F9AB40A",
      abi
    );

    // Find the WETH() for polyjuice
    console.log('WCKB: ' + await pancakeContract.WETH());

    // To deploy our contract, we just have to call Token.deploy() and await
    // for it to be deployed(), which happens once its transaction has been
    // mined.
    // hardhatToken = await Token.deploy();

    // Transfer 50 tokens from owner to addr1
    // const receipt = await hardhatToken.connect(addresses[0]).transfer(addresses[1].address, 50);
    // await logBalances(addresses, 1);
}

async function logBalances(addresses, transactionNumber) {
    console.log(
        '\ntransaction ' + transactionNumber + ':' +
        '\n\nowner: ' + await hardhatToken.balanceOf(addresses[0].address) +
        '\n1: ' + await hardhatToken.balanceOf(addresses[1].address) +
        '\n2: ' + await hardhatToken.balanceOf(addresses[2].address) +
        '\n3: ' + await hardhatToken.balanceOf(addresses[3].address) +
        '\n4: ' + await hardhatToken.balanceOf(addresses[4].address) +
        '\n5: ' + await hardhatToken.balanceOf(addresses[5].address) +
        '\n6: ' + await hardhatToken.balanceOf(addresses[6].address) +
        '\n7: ' + await hardhatToken.balanceOf(addresses[7].address) +
        '\n8: ' + await hardhatToken.balanceOf(addresses[8].address) +
        '\n9: ' + await hardhatToken.balanceOf(addresses[9].address) +
        '\n10: ' + await hardhatToken.balanceOf(addresses[10].address) +
        '\n11: ' + await hardhatToken.balanceOf(addresses[11].address)
    )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
    });

