// Read the file and print its contents.
var fs = require('fs')
  , filename = 'templates/rising_floor_no_rewards.sol';
fs.readFile(filename, 'utf8', async function(err, data) {
    if (err) throw err;
        
    console.log('OK: ' + filename);
    const content = data.split("\n");
    content.splice(155, 0, `contract PapapepToken is IBEP20, Auth {`);
    content.splice(159, 0, `    address public WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;`);
    content.splice(164, 0, `    string constant _name = "PapapepToken";`);
    content.splice(165, 0, `    string constant _symbol = "PAPAPEP";`);
    content.splice(166, 0, `    uint8 constant _decimals = 9;`);
    content.splice(168, 0, `    uint256 _totalSupply = 1_000_000_000_000_000 * (10 ** _decimals);`);
    content.splice(180, 0, `    uint256 liquidityFee = 400;`);
    content.splice(182, 0, `    uint256 backingFee = 200;`);
    content.splice(184, 0, `    uint256 marketingFee = 200;`);
    text = content.join("\n");
    try {
        await fs.writeFile('templates/fileCreated.sol', text, () => {});
    } catch (e) {
        console.log(e);
    }
});    