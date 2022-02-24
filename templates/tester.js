// Read the file and print its contents.
var fs = require('fs')
  , filename = 'templates/lg_rBNB_mw_ap.sol';
fs.readFile(filename, 'utf8', async function(err, data) {
    if (err) throw err;
        
    console.log('OK: ' + filename);
    const content = data.split("\n");
    content.splice(171, 0, `    address public WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;`);
    content.splice(211, 0, `        : IDEXRouter(0x10ED43C718714eb63d5aA57B78B54704E256024E);`);
    content.splice(385, 0, `contract PapapepToken is IBEP20, Auth {`);
    content.splice(389, 0, `    address public WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;`);
    content.splice(394, 0, `    string constant _name = "PapapepToken";`);
    content.splice(395, 0, `    string constant _symbol = "PAPAPEP";`);
    content.splice(396, 0, `    uint8 constant _decimals = 9;`);
    content.splice(399, 0, `    uint256 private _totalSupply = 1_000_000_000_000_000 * (10**_decimals);`);
    content.splice(410, 0, `    uint256 liquidityFee = 300;`);
    content.splice(412, 0, `    uint256 rewardsFee = 300;`);
    content.splice(414, 0, `    uint256 backingFee = 400;`);
    content.splice(416, 0, `    uint256 marketingFee = 300;`);
    text = content.join("\n");
    try {
        await fs.writeFile('templates/fileCreated.sol', text, () => {});
    } catch (e) {
        console.log(e);
    }
});    