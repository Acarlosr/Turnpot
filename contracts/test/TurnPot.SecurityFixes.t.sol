// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TurnPotTestBase} from "./TurnPot.Base.t.sol";
import {TurnPot} from "../TurnPot.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Helper contracts (defined at file scope so forge can compile them cleanly)
// ─────────────────────────────────────────────────────────────────────────────

/// @dev A contract that holds a TurnPot balance but cannot receive native value
///      (no payable receive/fallback).  Used to test withdrawTo rescue path.
contract NonPayableMember {
    TurnPot public immutable pot;

    constructor(TurnPot _pot) {
        pot = _pot;
    }

    /// Called externally by the test — this contract is msg.sender, so it MUST
    /// be in the members array for createPot to succeed.
    function createPotAs(
        address[] calldata members,
        uint256 contribution,
        uint256 roundDuration
    ) external returns (uint256) {
        return pot.createPot(members, contribution, roundDuration);
    }

    function contributeAs(uint256 potId) external payable {
        pot.contribute{value: msg.value}(potId);
    }

    function withdrawToEOA(address payable recipient) external {
        pot.withdrawTo(recipient);
    }

    function tryWithdraw() external {
        pot.withdraw();
    }
    // NO receive() or fallback() — native transfers to this contract revert
}

/// @dev Reentrancy attacker for withdrawTo: tries to re-enter withdrawTo in receive().
///      Uses try/catch so a failed reenter does not bubble up and abort the initial call.
contract MaliciousPayableReceiver {
    TurnPot public pot;
    uint256 public attackCount;

    constructor(TurnPot _pot) {
        pot = _pot;
    }

    function attack() external {
        pot.withdrawTo(payable(address(this)));
    }

    receive() external payable {
        attackCount++;
        if (attackCount < 3) {
            // Attempt reentry; swallow any revert so the outer call completes.
            try pot.withdrawTo(payable(address(this))) {} catch {}
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Security-fix tests
// ─────────────────────────────────────────────────────────────────────────────

contract TurnPotSecurityFixesTest is TurnPotTestBase {

    // =========================================================================
    // Fix 1 — CreatorNotMember
    // =========================================================================

    /// Non-member caller with a valid member array reverts CreatorNotMember.
    function test_createPot_creatorNotMember_reverts() public {
        address stranger = makeAddr("stranger");
        // stranger is NOT in the members array
        address[] memory m = new address[](2);
        m[0] = alice;
        m[1] = bob;

        vm.prank(stranger);
        vm.expectRevert(TurnPot.CreatorNotMember.selector);
        turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
    }

    /// Creator is members[0] — succeeds.
    function test_createPot_creatorIsFirstMember_succeeds() public {
        address[] memory m = new address[](3);
        m[0] = alice;
        m[1] = bob;
        m[2] = carol;

        vm.prank(alice); // members[0]
        uint256 potId = turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
        assertEq(potId, 0);
        assertEq(turnpot.potCount(), 1);
    }

    /// Creator is members[N-1] (last element) — succeeds.
    function test_createPot_creatorIsLastMember_succeeds() public {
        address[] memory m = new address[](3);
        m[0] = alice;
        m[1] = bob;
        m[2] = carol;

        vm.prank(carol); // members[2] = last
        uint256 potId = turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
        assertEq(potId, 0);
    }

    /// Creator is members[1] of 3 (middle element) — succeeds.
    function test_createPot_creatorIsMiddleMember_succeeds() public {
        address[] memory m = new address[](3);
        m[0] = alice;
        m[1] = bob;
        m[2] = carol;

        vm.prank(bob); // members[1] = middle
        uint256 potId = turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
        assertEq(potId, 0);
    }

    /// Griefing prevention: attacker tries to create a pot with victim addresses
    /// without being a member → reverts CreatorNotMember; victim's defaults stay 0.
    function test_griefing_cannotInflateDefaultsForVictim() public {
        address attacker = makeAddr("attacker");
        address victim   = makeAddr("victim");
        address victim2  = makeAddr("victim2");

        address[] memory m = new address[](2);
        m[0] = victim;
        m[1] = victim2;

        vm.prank(attacker);
        vm.expectRevert(TurnPot.CreatorNotMember.selector);
        turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);

        // No pot was created → potCount is still 0
        assertEq(turnpot.potCount(), 0);
        // Victim defaults were never touched
        assertEq(turnpot.defaults(victim),  0);
        assertEq(turnpot.defaults(victim2), 0);
    }

    // =========================================================================
    // Fix 2 — withdrawTo
    // =========================================================================

    /// NonPayableMember can withdraw its balance to an EOA via withdrawTo.
    function test_withdrawTo_nonPayableMemberCanWithdrawToEOA() public {
        NonPayableMember npm = new NonPayableMember(turnpot);
        vm.label(address(npm), "NonPayableMember");
        vm.deal(address(npm), 10 ether);

        address payable eoa = payable(makeAddr("eoa"));
        vm.deal(eoa, 0); // start with nothing

        // Build members array: npm is index 0 (recipient of round 0), alice is index 1.
        address[] memory m = new address[](2);
        m[0] = address(npm);
        m[1] = alice;

        // npm calls createPot — it IS members[0], satisfies CreatorNotMember.
        uint256 potId = npm.createPotAs(m, CONTRIBUTION, ROUND_DURATION);

        // Both contribute in round 0.
        npm.contributeAs{value: CONTRIBUTION}(potId);
        vm.prank(alice);
        turnpot.contribute{value: CONTRIBUTION}(potId);

        // Close round 0 — credits npm with 2 × CONTRIBUTION.
        turnpot.closeRound(potId);
        assertEq(turnpot.balanceOf(address(npm)), 2 * CONTRIBUTION);

        // npm.withdraw() fails because it has no receive().
        vm.expectRevert();
        npm.tryWithdraw();

        // npm.withdrawTo(eoa) succeeds.
        uint256 eoaBefore = eoa.balance;
        npm.withdrawToEOA(eoa);

        // eoa receives the payout.
        assertEq(eoa.balance - eoaBefore, 2 * CONTRIBUTION);
        // npm's internal balance is cleared.
        assertEq(turnpot.balanceOf(address(npm)), 0);
        // Contract balance is zero (no other pending payouts).
        assertEq(address(turnpot).balance, 0);
    }

    /// withdrawTo(address(0)) reverts InvalidRecipient.
    function test_withdrawTo_reverts_zeroRecipient() public {
        // Give alice a balance first so we reach the recipient check.
        _giveAliceBalance(CONTRIBUTION);

        vm.prank(alice);
        vm.expectRevert(TurnPot.InvalidRecipient.selector);
        turnpot.withdrawTo(payable(address(0)));
    }

    /// withdrawTo from an address with balanceOf == 0 reverts NothingToWithdraw.
    function test_withdrawTo_reverts_noBalance() public {
        address fresh = makeAddr("fresh");
        vm.prank(fresh);
        vm.expectRevert(TurnPot.NothingToWithdraw.selector);
        turnpot.withdrawTo(payable(alice));
    }

    /// WithdrawnTo(account, recipient, amount) event is emitted correctly.
    function test_withdrawTo_emitsWithdrawnTo() public {
        // _giveAliceBalance(CONTRIBUTION) creates a 2-member pot → alice gets 2 × CONTRIBUTION.
        _giveAliceBalance(CONTRIBUTION);
        uint256 aliceBalance = turnpot.balanceOf(alice); // == 2 * CONTRIBUTION

        address payable recipient = payable(makeAddr("recipient"));

        vm.expectEmit(true, true, false, true, address(turnpot));
        emit TurnPot.WithdrawnTo(alice, recipient, aliceBalance);
        vm.prank(alice);
        turnpot.withdrawTo(recipient);
    }

    /// Second call after a successful withdrawTo reverts NothingToWithdraw.
    function test_withdrawTo_cannotDoubleWithdraw() public {
        _giveAliceBalance(CONTRIBUTION);

        address payable recipient = payable(makeAddr("recipient"));

        vm.prank(alice);
        turnpot.withdrawTo(recipient);

        vm.prank(alice);
        vm.expectRevert(TurnPot.NothingToWithdraw.selector);
        turnpot.withdrawTo(recipient);
    }

    /// Reentrancy via withdrawTo is blocked — attacker receives exactly one payout.
    function test_withdrawTo_reentrancyBlocked() public {
        MaliciousPayableReceiver attacker = new MaliciousPayableReceiver(turnpot);
        vm.label(address(attacker), "MaliciousPayableReceiver");
        vm.deal(address(attacker), 10 ether);

        // Build pot: [attacker, alice, bob, carol] so attacker receives round-0 payout.
        address[] memory m = new address[](4);
        m[0] = address(attacker);
        m[1] = alice;
        m[2] = bob;
        m[3] = carol;

        vm.prank(address(attacker));
        uint256 potId = turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);

        // All four members contribute.
        vm.prank(address(attacker));
        turnpot.contribute{value: CONTRIBUTION}(potId);
        vm.prank(alice);
        turnpot.contribute{value: CONTRIBUTION}(potId);
        vm.prank(bob);
        turnpot.contribute{value: CONTRIBUTION}(potId);
        vm.prank(carol);
        turnpot.contribute{value: CONTRIBUTION}(potId);

        // Close round 0 — credits attacker with 4 × CONTRIBUTION.
        turnpot.closeRound(potId);
        uint256 expectedPayout = 4 * CONTRIBUTION;
        assertEq(turnpot.balanceOf(address(attacker)), expectedPayout);

        uint256 attackerBefore  = address(attacker).balance;
        uint256 contractBefore  = address(turnpot).balance;

        // Attack: attacker calls withdrawTo(this) and tries to reenter in receive().
        attacker.attack();

        // Attacker received exactly one payout — not drained multiple times.
        assertEq(address(attacker).balance - attackerBefore, expectedPayout);
        // TurnPot balance decreased by exactly one payout.
        assertEq(address(turnpot).balance, contractBefore - expectedPayout);
        // Attacker's internal balance is zero.
        assertEq(turnpot.balanceOf(address(attacker)), 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// Give alice a TurnPot balanceOf by running one 2-member round.
    function _giveAliceBalance(uint256 amount) internal {
        // Build a 2-member pot where alice is index 0 (round-0 recipient).
        address[] memory m = new address[](2);
        m[0] = alice;
        m[1] = bob;

        vm.prank(alice);
        uint256 potId = turnpot.createPot(m, amount, ROUND_DURATION);

        vm.prank(alice);
        turnpot.contribute{value: amount}(potId);
        vm.prank(bob);
        turnpot.contribute{value: amount}(potId);

        turnpot.closeRound(potId);
        // alice now has balanceOf == 2 × amount; we only need CONTRIBUTION worth
        // so let's confirm it's non-zero (the caller uses CONTRIBUTION as amount).
        assertEq(turnpot.balanceOf(alice), 2 * amount);

        // Withdraw the excess so alice has exactly `amount` for tests that
        // need a specific balance — but most tests here just need non-zero.
        // Leave full balance; callers are aware it's 2 × amount.
    }
}
