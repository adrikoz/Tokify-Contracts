// Read the file and print its contents.
var fs = require('fs')
  , filename = 'templates/lg_rBNB_mw_ap.sol';
fs.readFile(filename, 'utf8', async function(err, data) {
    if (err) throw err;
        
    console.log('OK: ' + filename);
    const content = data.split("\n");
    content.splice(338, 0, `contract PapapepToken is IBEP20, Auth {`);
    content.splice(342, 0, `    address public WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;`);
    content.splice(347, 0, `    string constant _name = "PapapepToken";`);
    content.splice(348, 0, `    string constant _symbol = "PAPAPEP";`);
    content.splice(349, 0, `    uint8 constant _decimals = 9;`);
    content.splice(351, 0, `    uint256 private _totalSupply = 1_000_000_000_000_000 * (10**_decimals);`);
    content.splice(362, 0, `    uint256 liquidityFee = 300;`);
    content.splice(364, 0, `    uint256 reflectionFee = 300;`);
    content.splice(366, 0, `    uint256 marketingFee = 400;`);
    content.splice(372, 0, `    uint256 buyMultiplier = 5000;`);
    content.splice(373, 0, `    uint256 sellMultiplier = 20000;`);
    content.splice(376, 0, `    address public marketingFeeReceiver = 0xa83038843bd7F6e26e5a741095FA85038A54d68a;`);
    content.splice(401, 0, `        address _dexRouter = 0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3;`);

    text = content.join("\n");
    try {
        await fs.writeFile('templates/fileCreated.sol', text, () => {});
    } catch (e) {
        console.log(e);
    }
});    