//SPDX-License-Identifier: No License
pragma solidity ^0.8.7;

library SafeMath {

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    function sub(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    function div(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;

        return c;
    }
}

contract Ownable {
    address private _owner;

    event OwnershipRenounced(address indexed previousOwner);

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    constructor() {
        _owner = msg.sender;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(isOwner());
        _;
    }

    function isOwner() public view returns (bool) {
        return msg.sender == _owner;
    }

    function renounceOwnership() public onlyOwner {
        emit OwnershipRenounced(_owner);
        _owner = address(0);
    }

    function transferOwnership(address newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0));
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

library Roles {
    struct Role {
        mapping (address => bool) bearer;
    }

    /**
     * @dev Give an account access to this role.
     */
    function add(Role storage role, address account) internal {
        require(!has(role, account), "Roles: account already has role");
        role.bearer[account] = true;
    }

    /**
     * @dev Remove an account's access to this role.
     */
    function remove(Role storage role, address account) internal {
        require(has(role, account), "Roles: account does not have role");
        role.bearer[account] = false;
    }

    /**
     * @dev Check if an account has this role.
     * @return bool
     */
    function has(Role storage role, address account) internal view returns (bool) {
        require(account != address(0), "Roles: account is the zero address");
        return role.bearer[account];
    }
}

contract CallerRole {
    using Roles for Roles.Role;

    event CallerAdded(address indexed account);
    event CallerRemoved(address indexed account);

    Roles.Role private _Callers;

    constructor () {
        _addCaller(msg.sender);
    }

    modifier onlyCaller() {
        require(isCaller(msg.sender), "CallerRole: caller does not have the Caller role");
        _;
    }

    function isCaller(address account) public view returns (bool) {
        return _Callers.has(account);
    }

    function renounceCaller() public {
        _removeCaller(msg.sender);
    }

    function _addCaller(address account) internal {
        _Callers.add(account);
        emit CallerAdded(account);
    }

    function _removeCaller(address account) internal {
        _Callers.remove(account);
        emit CallerRemoved(account);
    }
}

contract IKEContract {
    function rebase(uint256 epoch, int256 supplyDelta) external returns (uint256) {}
    function totalSupply() external view returns (uint256) {}
}

contract Rebaser is Ownable, CallerRole {
    using SafeMath for uint256;

    uint256 public multiplier;
    uint256 public denominator;
    IKEContract public contractToCall;
    uint256 public lastTimestamp;
    uint256 public minutesBetween;

    constructor(
        uint256 _multiplier,
        uint256 _denominator,
        address _contractToCall,
        uint256 _minutesBetween
    ) {
        multiplier = _multiplier;
        denominator = _denominator;
        contractToCall = IKEContract(_contractToCall);
        minutesBetween = _minutesBetween;
    }

    /// To be called by bot
    function callRebase() external onlyCaller {
        require(block.timestamp - lastTimestamp > minutesBetween * 1 minutes);
        uint256 currentSupply = contractToCall.totalSupply();
        uint256 newSupply = currentSupply.mul(multiplier).div(denominator);
        uint256 supplyDelta = newSupply.sub(currentSupply);
        lastTimestamp = block.timestamp;
        contractToCall.rebase(lastTimestamp, int256(supplyDelta));
    }

    /// To be called by owner if bot fails
    function callRebaseOverride() external onlyOwner {
        uint256 currentSupply = contractToCall.totalSupply();
        uint256 newSupply = currentSupply.mul(multiplier).div(denominator);
        uint256 supplyDelta = newSupply.sub(currentSupply);
        uint256 epoch = block.timestamp;
        contractToCall.rebase(epoch, int256(supplyDelta));
    }

    function addCaller(address account) public onlyOwner {
        _addCaller(account);
    }

    function setRate(uint256 _multiplier, uint256 _denominator) external onlyOwner {
        multiplier = _multiplier;
        denominator = _denominator;
    }

    function changeContractToCall(address _contractToCall) external onlyOwner {
        contractToCall = IKEContract(_contractToCall);
    }

    function changeMinutesBetween(uint256 _minutes) external onlyOwner {
        minutesBetween = _minutes;
    }
}