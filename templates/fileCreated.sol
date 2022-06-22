//SPDX-License-Identifier: No License
pragma solidity ^0.8.0;
 
// Made in partnership with Tokify
 
/**
 * SAFEMATH LIBRARY
 */
library SafeMath {
 
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        return a + b;
    }
 
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return a - b;
    }
 
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        return a * b;
    }
 
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return a / b;
    }
 
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        unchecked {
            require(b <= a, errorMessage);
            return a - b;
        }
    }
}
 
interface IBEP20 {
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function name() external view returns (string memory);
    function getOwner() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address _owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
 
abstract contract Auth {
    address internal owner;
    mapping (address => bool) internal authorizations;
 
    constructor(address _owner) {
        owner = _owner;
        authorizations[_owner] = true;
    }
 
    /**
     * Function modifier to require caller to be contract owner
     */
    modifier onlyOwner() {
        require(isOwner(msg.sender), "!OWNER"); _;
    }
 
    /**
     * Function modifier to require caller to be authorized
     */
    modifier authorized() {
        require(isAuthorized(msg.sender), "!AUTHORIZED"); _;
    }
 
    /**
     * Authorize address. Owner only
     */
    function authorize(address adr) public onlyOwner {
        authorizations[adr] = true;
    }
 
    /**
     * Remove address' authorization. Owner only
     */
    function unauthorize(address adr) public onlyOwner {
        authorizations[adr] = false;
    }
 
    /**
     * Check if address is owner
     */
    function isOwner(address account) public view returns (bool) {
        return account == owner;
    }
 
    /**
     * Return address' authorization status
     */
    function isAuthorized(address adr) public view returns (bool) {
        return authorizations[adr];
    }
 
    /**
     * Transfer ownership to new address. Caller must be owner. Leaves old owner authorized
     */
    function transferOwnership(address payable adr) public onlyOwner {
        owner = adr;
        authorizations[adr] = true;
        emit OwnershipTransferred(adr);
    }
 
    event OwnershipTransferred(address owner);
}
 
interface IDEXFactory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}
 
interface IDEXPair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 bassetPoolLockTimestampLast);
    function token0() external view returns (address);
}
 
interface IDEXRouter {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
 
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
 
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;
 
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}
 
/** @dev this token is backed by BNB, which can be sent to the contract by anyone and can be redeemed by burning the token. 
 
When burning the token, the amount of BNB given is calculated by taking (token amount)/(circulating supply) and giving that fraction of the asset pool BNB.
*/ 
 
contract PapapepToken is IBEP20, Auth {
    using SafeMath for uint256;
 
    uint256 public constant MASK = type(uint128).max;
    address public WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address DEAD = 0x000000000000000000000000000000000000dEaD;
    address ZERO = 0x0000000000000000000000000000000000000000;
    address DEAD_NON_CHECKSUM = 0x000000000000000000000000000000000000dEaD;
 
    string constant _name = "PapapepToken";
    string constant _symbol = "PAPAPEP";
    uint8 constant _decimals = 9;
 
    uint256 _totalSupply = 1_000_000_000_000_000 * (10 ** _decimals);
    uint256 public _maxTxAmount = _totalSupply.div(400); // 0.25%
 
    mapping (address => uint256) _balances;
    mapping (address => mapping (address => uint256)) _allowances;
 
    mapping (address => bool) isFeeExempt;
    mapping (address => bool) isTxLimitExempt;
    mapping (address => bool) isExcludedFromPause;
    mapping (address => bool) isBlacklisted;
 
    /// @dev liquidityFee determines tax to send to the liquidity pool
    uint256 liquidityFee = 400;
    /// @dev backingFee determines tax to send to the asset pool, which backs the token
    uint256 backingFee = 200;
    /// @dev marketingFee determines tax to send to the marketing wallet
    uint256 marketingFee = 200;
    uint256 totalFee = liquidityFee.add(backingFee).add(marketingFee);
    /// @dev fee denominator allows taxes to be decimal number percentages
    uint256 feeDenominator = 10000;
    uint256 public maxSellFee = 3000;
    uint256 public maxSellMultiplier = 50000;

    uint256 public baseTaxesAccumulated;
    uint256 public sellingTaxAccumulated;
 
    address public autoLiquidityReceiver;
    address public marketingFeeReceiver;
    address generatorFeeReceiver = 0xF6bF36933149030ed4B212F0a79872306690e48e;
    uint256 generatorFee = 500;
 
    /// @dev takeFeeActive allows to temporarily pause any taxes
    bool takeFeeActive = true;
 
    uint256 targetLiquidity = 25;
    uint256 targetLiquidityDenominator = 100;
 
    IDEXRouter public router;
    address public pair;

    uint256 public assetPoolLockTimestamp;
    uint256 public assetPoolLockTime;
    bool public isPaused;
 
    /// @dev before processing taxes in BNB, the taxed token is accumulated in the contract to save on gas fees
    /// @dev the swap to BNB will only occur once the swapThreshold is reached
    bool public swapEnabled = true;
    uint256 public swapThreshold = _totalSupply / 2000; // 0.05%
    uint256 public sellingSwapThreshold = _totalSupply / 2000; // 0.05%
    bool inSwap;
    modifier swapping() { inSwap = true; _; inSwap = false; }
 
    constructor (
        address _dexRouter,
        address _marketingFeeReceiver
        ) Auth(msg.sender) {
        /// @dev set the router address and create pair
        router = IDEXRouter(_dexRouter);
        pair = IDEXFactory(router.factory()).createPair(WBNB, address(this));
        _allowances[address(this)][address(router)] = _totalSupply;
        WBNB = router.WETH();
 
        isFeeExempt[msg.sender] = true;
        isExcludedFromPause[msg.sender] = true;
        isTxLimitExempt[msg.sender] = true;
 
        autoLiquidityReceiver = msg.sender;
        marketingFeeReceiver = _marketingFeeReceiver;
 
        approve(_dexRouter, _totalSupply);
        approve(address(pair), _totalSupply);
        _balances[msg.sender] = _totalSupply;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }
 
    receive() external payable {}
 
    function totalSupply() external view override returns (uint256) { return _totalSupply; }
    function decimals() external pure override returns (uint8) { return _decimals; }
    function symbol() external pure override returns (string memory) { return _symbol; }
    function name() external pure override returns (string memory) { return _name; }
    function getOwner() external view override returns (address) { return owner; }
    function balanceOf(address account) public view override returns (uint256) { return _balances[account]; }
    function allowance(address holder, address spender) external view override returns (uint256) { return _allowances[holder][spender]; }
 
    function approve(address spender, uint256 amount) public override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
 
    function approveMax(address spender) external returns (bool) {
        return approve(spender, _totalSupply);
    }
 
    function transfer(address recipient, uint256 amount) external override returns (bool) {
        return _transferFrom(msg.sender, recipient, amount);
    }
 
    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        if(_allowances[sender][msg.sender] != _totalSupply){
            _allowances[sender][msg.sender] = _allowances[sender][msg.sender].sub(amount, "Insufficient Allowance");
        }
 
        return _transferFrom(sender, recipient, amount);
    }
 
    function _transferFrom(address sender, address recipient, uint256 amount) internal returns (bool) {
        require(isBlacklisted[sender] == false && isBlacklisted[recipient] == false,"WARNING: either sender or recipient is blacklisted, contact an administrator for assitance");
        if(isPaused){
          require(isExcludedFromPause[sender] == true || isExcludedFromPause[recipient] == true,"WARNING: contract is in pause for maintenance");
        }
        /// @dev if the token is currently being swapped by the contract into BNB, then no taxes apply
        if(inSwap){ return _basicTransfer(sender, recipient, amount); }
        /// @dev if the token is being burned then the recipient will be reimbursed with BNB according to the amount in the asset pool
        if(recipient == DEAD){ return _burnForBNB(sender, amount); }
        /// @dev check that the size of the transaction is not over the transaction limit
        checkTxLimit(sender, amount);
        /// @dev check if enough of the token has been accumulated in the contract to swap into BNB and if so then swap the token accumulated in contract to BNB
        /// @dev only do either selling or base tax swap back at a single time
        if(shouldSwapBack()){ swapBack(); }
        else if(shouldSwapBackSelling()){ swapBackSelling(); }
 
        _balances[sender] = _balances[sender].sub(amount, "Insufficient Balance");
 
        uint256 amountReceived = shouldTakeFee(sender) ? takeFee(sender, recipient, amount) : amount;
 
        _balances[recipient] = _balances[recipient].add(amountReceived);
        if(recipient == address(this)) {sellingTaxAccumulated = sellingTaxAccumulated.add(amount);}
 
        emit Transfer(sender, recipient, amountReceived);
        return true;
    }
 
    function _basicTransfer(address sender, address recipient, uint256 amount) internal returns (bool) {
        _balances[sender] = _balances[sender].sub(amount, "Insufficient Balance");
        _balances[recipient] = _balances[recipient].add(amount);
//        emit Transfer(sender, recipient, amount);
        return true;
    }
 
    function checkTxLimit(address sender, uint256 amount) internal view {
        require(amount <= _maxTxAmount || isTxLimitExempt[sender], "TX Limit Exceeded");
    }
 
    /// @dev check if taking fee is active and if yes if the sender is exempt from the fee
    function shouldTakeFee(address sender) internal view returns (bool) {
        if (takeFeeActive == false) {
            return false;
        }
        return !isFeeExempt[sender];
    }
 
    /// @dev multiply fee by selling multiplier if person is selling the token
    /// @dev sell multiplier is set depending on the current gap ratio proportionally
    function getSellMultipliedFee() public view returns (uint256) {
        uint256 sellMultiplier = getCurrentGapRatio(feeDenominator);
        if(sellMultiplier <= feeDenominator){
            sellMultiplier = feeDenominator;
        }
        if(sellMultiplier >= maxSellMultiplier){
            sellMultiplier = maxSellMultiplier;
        }
        uint256 sellFee = totalFee.mul(sellMultiplier).div(feeDenominator);
        /// @dev allow a maximum sell fee of 5000
        if(sellFee > maxSellFee){
            sellFee = maxSellFee;
        }
        return sellFee;
    }
 
    /// @dev check ratio of LP price and the floor price determined by the BNB held in asset pool
    function getCurrentGapRatio(uint256 denominator) public view returns (uint256) {
        IDEXPair routerPair = IDEXPair(pair);
        address token0 = routerPair.token0();
        uint256 reservesBNB;
        uint256 reservesToken;
        if(token0 == WBNB) {
            (reservesBNB, reservesToken,) = routerPair.getReserves();
        } else if (token0 == address(this)) {
            (reservesToken, reservesBNB,) = routerPair.getReserves();
        }
        uint256 bnbAsset = getAmountBNBInAssetPool();
        if(bnbAsset == 0) {
            bnbAsset = 1;
        }
        uint256 gapRatio = denominator.mul(getCirculatingSupply().mul(reservesBNB)).div(reservesToken.mul(bnbAsset));
        return gapRatio;
    }

    /// @dev calculae the total fee to be taken on the transaction
    function getTotalFee(bool selling) public view returns (uint256) {
        if(selling){ return getSellMultipliedFee(); }
        return totalFee;
    }

    /// @dev figure out the amount transferred when taxes are deducted and add the taxes to this contract
    function takeFee(address sender, address receiver, uint256 amount) internal returns (uint256) {
        bool selling = receiver == pair;
        uint256 feeAmount = amount.mul(getTotalFee(selling)).div(feeDenominator);
        if (selling) {
            uint256 baseFee = amount.mul(totalFee).div(feeDenominator);
            uint256 sellingFee = feeAmount.sub(baseFee);
            sellingTaxAccumulated = sellingTaxAccumulated.add(sellingFee);
            baseTaxesAccumulated = baseTaxesAccumulated.add(baseFee);
        } else {
            baseTaxesAccumulated = baseTaxesAccumulated.add(feeAmount);
        }
 
        _balances[address(this)] = _balances[address(this)].add(feeAmount);


        emit Transfer(sender, address(this), feeAmount);
 
        return amount.sub(feeAmount);
    }
 
    function shouldSwapBack() internal view returns (bool) {
        return msg.sender != pair
        && !isPaused
        && !inSwap
        && swapEnabled
        && baseTaxesAccumulated >= swapThreshold;
    }
 
    /// @dev function to swap the token accumulated in the contract through taxes into BNB
    /// @dev the BNB is then accordingly distributed into the rewards pool, the liquidity pool and the marketing wallet
    function swapBack() internal swapping {
        uint256 dynamicLiquidityFee = isOverLiquified(targetLiquidity, targetLiquidityDenominator) ? 0 : liquidityFee;
        uint256 amountToLiquify = swapThreshold.mul(dynamicLiquidityFee).div(totalFee).div(2);
        uint256 amountToSwap = swapThreshold.sub(amountToLiquify);
 
        /// @dev set the path through which the contract exchanges the token to BNB
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = WBNB;
        uint256 balanceBefore = address(this).balance;
 
        /// @dev exchange the token for BNB
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amountToSwap,
            0,
            path,
            address(this),
            block.timestamp
        );

        baseTaxesAccumulated = balanceOf(address(this)).sub(sellingTaxAccumulated);
 
        /// @dev caluculate how much new BNB has been converted
        uint256 amountBNB = address(this).balance.sub(balanceBefore);
 
        uint256 totalBNBFee = totalFee.sub(dynamicLiquidityFee.div(2));
 
        /// @dev since adding to liquidity pool requires both BNB and the token, we only convert half of it
        uint256 amountBNBLiquidity = amountBNB.mul(dynamicLiquidityFee).div(totalBNBFee).div(2);
        uint256 amountBNBMarketing = amountBNB.mul(marketingFee).div(totalBNBFee);
        /// @dev there is no value here for the backing fee in BNB, since it would be in the contract after conversion to BNB anyway
 
        sendSwappedBNB(amountBNBMarketing);
 
        /// @dev transfer the portion of taxes taken for liquidity pool to the liquidity pool
        if(amountToLiquify > 0){
            router.addLiquidityETH{value: amountBNBLiquidity}(
                address(this),
                amountToLiquify,
                0,
                0,
                autoLiquidityReceiver,
                block.timestamp
            );
            baseTaxesAccumulated = balanceOf(address(this)).sub(sellingTaxAccumulated);
            emit AutoLiquify(amountBNBLiquidity, amountToLiquify);
        }
    }

    function shouldSwapBackSelling() internal view returns (bool) {
        return msg.sender != pair
        && !isPaused
        && !inSwap
        && swapEnabled
        && sellingTaxAccumulated >= sellingSwapThreshold;
    }

    /// @dev function to swap the token accumulated in extra selling taxes to go to asset pool
    function swapBackSelling() internal swapping {
 
        /// @dev set the path through which the contract exchanges the token to BNB
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = WBNB;
 
        /// @dev exchange the token for BNB
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            sellingSwapThreshold,
            0,
            path,
            address(this),
            block.timestamp
        );

        sellingTaxAccumulated = balanceOf(address(this)).sub(baseTaxesAccumulated);
    }

    function sendSwappedBNB(uint256 amountBNBMarketing) internal {
 
        /// @dev tax on the marketing wallet going towards the contract generator platform
        uint256 generatorAmount = amountBNBMarketing.mul(generatorFee).div(
            feeDenominator
        );
        uint256 marketingAmount = amountBNBMarketing.sub(generatorAmount);
 
        (bool marketingTransferSuccess,) = address(marketingFeeReceiver).call{value: marketingAmount}("");
        require(marketingTransferSuccess);
        (bool generatorTransferSuccess,) = address(generatorFeeReceiver).call{value: generatorAmount}("");
        require(generatorTransferSuccess);
    }
 
    /// @dev set the transaction limit
    function setTxLimit(uint256 amount) external authorized {
        require(amount >= _totalSupply / 1000);
        _maxTxAmount = amount;
    }

    /// @dev set the maximum sell fee that can be applied with a denominator of 10,000
    function setMaxSellFeeDenominator10000(uint256 _maxSellFee) external authorized {
        require(_maxSellFee <= 5000, "Value too high");
        require(_maxSellFee >= totalFee, "Value too low");
        maxSellFee = _maxSellFee;
    }

    /// @dev set the maximum sell multiplier that can be applied with a denominator of 10,000
    function setMaxSellMultiplierDenominator10000(uint256 _maxSellMultiplier) external authorized {
        require(_maxSellMultiplier <= 100000, "Value too high");
        require(_maxSellMultiplier >= 10000, "Value too low");
        maxSellMultiplier = _maxSellMultiplier;
    }
 
    /// @dev set whether an address is exempt from the fee
    function excludeFromFee(address[] memory accounts) public authorized {
        uint256 length = accounts.length;
        for (uint i=0; i<length; i++) {
            isFeeExempt[accounts[i]] = true;
        }
    }

    /// @dev set whether an address is exempt from the fee
    function includeInFee(address[] memory accounts) public authorized {
        uint256 length = accounts.length;
        for (uint i=0; i<length; i++) {
            isFeeExempt[accounts[i]] = false;
        }
    }
 
    /// @dev set whether an address is exempt from the maximum transaction limit
    function setIsTxLimitExempt(address holder, bool exempt) external authorized {
        isTxLimitExempt[holder] = exempt;
    }
 
    /// @dev set the fees with a denominator of 10000
    function setFeesWithDenominator10000(
        uint256 _liquidityFee,
        uint256 _backingFee,
        uint256 _marketingFee
    ) external authorized {
        liquidityFee = _liquidityFee;
        backingFee = _backingFee;
        marketingFee = _marketingFee;
        totalFee = _liquidityFee.add(_backingFee).add(_marketingFee);
        if(totalFee > maxSellFee) {
            maxSellFee = totalFee;
        }
        require(totalFee < feeDenominator / 4);
    }
 
    /// @dev set the addresses that benefit from the marketing fee and those that receive the liquidity
    function setFeeReceivers(address _autoLiquidityReceiver, address _marketingFeeReceiver) external authorized {
        autoLiquidityReceiver = _autoLiquidityReceiver;
        marketingFeeReceiver = _marketingFeeReceiver;
    }
 
    /// @dev set whether the contract can swap back its accumulated token into BNB and set the threshold for this
    function setSwapBackSettings(bool _enabled, uint256 _amount, uint256 _sellingAmount) external authorized {
        swapEnabled = _enabled;
        swapThreshold = _amount;
        sellingSwapThreshold = _sellingAmount;
    }

    /// @dev set the maximum amount of liquidity up to which taxes keep being sent to the pool
    function setTargetLiquidity(uint256 _target, uint256 _denominator) external authorized {
        targetLiquidity = _target;
        targetLiquidityDenominator = _denominator;
    }

    /// @dev enable or disable the fee
    function setFeeActive(bool setTakeFeeActive) external authorized {
        takeFeeActive = setTakeFeeActive;
    }
 
    /// @dev get the token supply not stored in the burn wallets
    function getCirculatingSupply() public view returns (uint256) {
        return _totalSupply.sub(balanceOf(DEAD)).sub(balanceOf(ZERO));
    }
 
    /// @dev check whether too much of the token is in the liquidity pool
    function isOverLiquified(uint256 target, uint256 accuracy) public view returns (bool) {
        return accuracy.mul(balanceOf(pair).mul(2)).div(getCirculatingSupply()) > target;
    }
 
    /// @dev get amount of BNB stored in the asset pool (this contract)
    function getAmountBNBInAssetPool() public view returns (uint256) {
        return address(this).balance;
    }

    function lockAssetRewardPools(uint256 _numberOfDays) external onlyOwner {
        assetPoolLockTimestamp = block.timestamp;
        assetPoolLockTime = _numberOfDays.mul(1 days);
    }

    /// @dev necessary for contract upgrades. Can do at most every 10 days
    function pauseContract() external onlyOwner {
        isPaused = true;
    }

    /// @dev necessary for contract upgrades. Can do at most every 10 days
    function unpauseContract() external onlyOwner {
        isPaused = false;
    }

    /// @dev exclude specific wallets from the pause
    function excludeFromPause(address[] memory accounts) public authorized {
        uint256 length = accounts.length;
        for (uint i=0; i<length; i++) {
            isExcludedFromPause[accounts[i]] = true;
        }
    }

    /// @dev include and address in the pause
    function includeInPause(address[] memory accounts) public authorized {
        uint256 length = accounts.length;
        for (uint i=0; i<length; i++) {
            require(isOwner(accounts[i]) == false, "ERR: owner can't be included");
            isExcludedFromPause[accounts[i]] = false;
        }
    }

    /// @dev exclude specific wallets from the pause
    function excludeFromBlacklist(address account) public authorized {
        isBlacklisted[account] = false;
    }

    /// @dev include and address in the pause
    function includeInBlacklist(address account) public authorized {
        isBlacklisted[account] = true;
    }

    /// @dev necessary for contract upgrades
    function moveAssetPool(address recipient) external onlyOwner {
        require(block.timestamp >= assetPoolLockTimestamp + assetPoolLockTime, "Asset pool currently locked");
        uint256 amountAssetPoolBNBToTransfer = address(this).balance;
        (bool success,) = address(recipient).call{value: amountAssetPoolBNBToTransfer}("");
        require(success);
    }
 
    /// @dev allow holders to burn their token in exchange for BNB stored in the asset and rewards pool
    function burnForBNB(uint256 amount) external returns (bool) {
        address sender = msg.sender;
        return _burnForBNB(sender, amount);
    }
 
    /// @dev function to process the sending of BNB to person burning the token
    function _burnForBNB(address sender, uint256 amount) internal returns (bool) {
        require(isBlacklisted[sender] == false,"WARNING: this account is blacklisted, contact an administrator for assitance");
        if(isPaused){
          require(isExcludedFromPause[sender] == true,"WARNING: contract is in pause for upgrade");
        }
        /// @dev calculate amount BNB to transfer to wallet burning the token
        /// @dev this is done by taking the fraction of the circulating supply being burned and multiplying it with the BNB stored in the asset pool
        uint256 amountBNBToTransfer = getAmountBNBInAssetPool().mul(amount).div(getCirculatingSupply());
 
        address recipient = DEAD;
        /// @dev if not enough token to burn then transaction will be reverted and BNB will not be sent
        _balances[sender] = _balances[sender].sub(amount, "Insufficient Balance");
        _balances[recipient] = _balances[recipient].add(amount);
 
        /// @dev send BNB from asset pool to function callr
        (bool success,) = address(sender).call{value: amountBNBToTransfer}("");
        require(success);
 
        emit Transfer(sender, recipient, amount);
        return true;
    }
 
    event AutoLiquify(uint256 amountBNB, uint256 amountBOG);
}