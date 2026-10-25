// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TurnPot is ReentrancyGuard {
    uint256 public constant MAX_CONTRIBUTION = 1 ether;

    enum Status {
        Active,
        Completed,
        Cancelled
    }

    struct Pot {
        address[] members;
        uint256 contribution;
        uint256 roundDuration;
        uint256 currentRound;
        uint256 roundStart;
        Status status;
    }

    uint256 public potCount;
    mapping(uint256 => Pot) private _pots;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) private _paid;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public defaults;

    error PotNotFound();
    error NotMember();
    error AlreadyPaid();
    error WrongAmount();
    error RoundNotOver();
    error RoundExpired();
    error NotAllPaid();
    error AllPaid();
    error PotNotActive();
    error InvalidMembers();
    error InvalidContribution();
    error InvalidDuration();
    error NothingToWithdraw();
    error CreatorNotMember();
    error InvalidRecipient();

    event PotCreated(uint256 indexed potId, address[] members, uint256 contribution, uint256 roundDuration);
    event Contributed(uint256 indexed potId, uint256 indexed round, address indexed member);
    event RoundClosed(uint256 indexed potId, uint256 round, address indexed recipient, uint256 amount);
    event RoundCancelled(uint256 indexed potId, uint256 round);
    event Withdrawn(address indexed account, uint256 amount);
    event WithdrawnTo(address indexed account, address indexed recipient, uint256 amount);

    function createPot(
        address[] calldata members,
        uint256 contribution,
        uint256 roundDuration
    ) external returns (uint256 potId) {
        uint256 length = members.length;
        if (length < 2 || length > 10) revert InvalidMembers();
        if (contribution == 0 || contribution > MAX_CONTRIBUTION) revert InvalidContribution();
        if (roundDuration < 60) revert InvalidDuration();

        for (uint256 i = 0; i < length; i++) {
            if (members[i] == address(0)) revert InvalidMembers();
            for (uint256 j = i + 1; j < length; j++) {
                if (members[i] == members[j]) revert InvalidMembers();
            }
        }

        bool creatorIsMember = false;
        for (uint256 i = 0; i < length; i++) {
            if (members[i] == msg.sender) {
                creatorIsMember = true;
                break;
            }
        }
        if (!creatorIsMember) revert CreatorNotMember();

        potId = potCount;
        potCount = potCount + 1;

        Pot storage pot = _pots[potId];
        for (uint256 i = 0; i < length; i++) {
            pot.members.push(members[i]);
        }
        pot.contribution = contribution;
        pot.roundDuration = roundDuration;
        pot.currentRound = 0;
        pot.roundStart = block.timestamp;
        pot.status = Status.Active;

        emit PotCreated(potId, members, contribution, roundDuration);
    }

    function contribute(uint256 potId) external payable {
        Pot storage pot = _getPotOrRevert(potId);
        if (pot.status != Status.Active) revert PotNotActive();
        if (!_isMember(pot, msg.sender)) revert NotMember();
        if (msg.value != pot.contribution) revert WrongAmount();

        uint256 round = pot.currentRound;
        if (_paid[potId][round][msg.sender]) revert AlreadyPaid();
        if (block.timestamp > pot.roundStart + pot.roundDuration) revert RoundExpired();

        _paid[potId][round][msg.sender] = true;

        emit Contributed(potId, round, msg.sender);
    }

    function closeRound(uint256 potId) external {
        Pot storage pot = _getPotOrRevert(potId);
        if (pot.status != Status.Active) revert PotNotActive();

        uint256 length = pot.members.length;
        uint256 round = pot.currentRound;
        uint256 count = _paidCount(potId, round, pot.members);
        if (count != length) revert NotAllPaid();

        address recipient = pot.members[round];
        uint256 amount = pot.contribution * length;
        balanceOf[recipient] += amount;

        emit RoundClosed(potId, round, recipient, amount);

        pot.currentRound = round + 1;
        if (pot.currentRound == length) {
            pot.status = Status.Completed;
        } else {
            pot.roundStart = block.timestamp;
        }
    }

    function cancelRound(uint256 potId) external {
        Pot storage pot = _getPotOrRevert(potId);
        if (pot.status != Status.Active) revert PotNotActive();
        if (block.timestamp <= pot.roundStart + pot.roundDuration) revert RoundNotOver();

        uint256 length = pot.members.length;
        uint256 round = pot.currentRound;
        uint256 count = _paidCount(potId, round, pot.members);
        if (count == length) revert AllPaid();

        for (uint256 i = 0; i < length; i++) {
            address member = pot.members[i];
            if (_paid[potId][round][member]) {
                balanceOf[member] += pot.contribution;
            } else {
                defaults[member] += 1;
            }
        }

        pot.status = Status.Cancelled;

        emit RoundCancelled(potId, round);
    }

    function withdraw() external nonReentrant {
        uint256 amount = balanceOf[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        balanceOf[msg.sender] = 0;

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);

        emit Withdrawn(msg.sender, amount);
    }

    function withdrawTo(address payable recipient) external nonReentrant {
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 amount = balanceOf[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        balanceOf[msg.sender] = 0;

        (bool ok,) = recipient.call{value: amount}("");
        require(ok);

        emit WithdrawnTo(msg.sender, recipient, amount);
    }

    function getPot(
        uint256 potId
    )
        external
        view
        returns (
            address[] memory members,
            uint256 contribution,
            uint256 roundDuration,
            uint256 currentRound,
            uint256 roundStart,
            Status status
        )
    {
        Pot storage pot = _getPotOrRevert(potId);
        return (
            pot.members,
            pot.contribution,
            pot.roundDuration,
            pot.currentRound,
            pot.roundStart,
            pot.status
        );
    }

    function hasPaid(uint256 potId, uint256 round, address member) external view returns (bool) {
        _getPotOrRevert(potId);
        return _paid[potId][round][member];
    }

    function roundDeadline(uint256 potId) external view returns (uint256) {
        Pot storage pot = _getPotOrRevert(potId);
        return pot.roundStart + pot.roundDuration;
    }

    function paidCount(uint256 potId) external view returns (uint256) {
        Pot storage pot = _getPotOrRevert(potId);
        return _paidCount(potId, pot.currentRound, pot.members);
    }

    function _getPotOrRevert(uint256 potId) internal view returns (Pot storage pot) {
        if (potId >= potCount) revert PotNotFound();
        pot = _pots[potId];
    }

    function _isMember(Pot storage pot, address account) internal view returns (bool) {
        uint256 length = pot.members.length;
        for (uint256 i = 0; i < length; i++) {
            if (pot.members[i] == account) {
                return true;
            }
        }
        return false;
    }

    function _paidCount(uint256 potId, uint256 round, address[] storage members) internal view returns (uint256 count) {
        uint256 length = members.length;
        for (uint256 i = 0; i < length; i++) {
            if (_paid[potId][round][members[i]]) {
                count += 1;
            }
        }
    }
}
