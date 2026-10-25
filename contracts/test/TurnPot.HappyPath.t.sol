// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TurnPotTestBase} from "./TurnPot.Base.t.sol";
import {TurnPot} from "../TurnPot.sol";

/// @dev Test 1 — Full happy-path: 4 members, all 4 rounds.
contract TurnPotHappyPathTest is TurnPotTestBase {
    uint256 internal potId;

    function setUp() public override {
        super.setUp();
        potId = _createDefaultPot();
    }

    // ── createPot sanity ─────────────────────────────────────────────────────

    function test_CreatePot_SetsCorrectState() public view {
        assertEq(turnpot.potCount(), 1);

        (
            address[] memory members,
            uint256 contribution,
            uint256 roundDuration,
            uint256 currentRound,
            ,
            TurnPot.Status status
        ) = turnpot.getPot(potId);

        assertEq(members.length, 4);
        assertEq(members[0], alice);
        assertEq(members[1], bob);
        assertEq(members[2], carol);
        assertEq(members[3], dave);
        assertEq(contribution, CONTRIBUTION);
        assertEq(roundDuration, ROUND_DURATION);
        assertEq(currentRound, 0);
        assertEq(uint8(status), STATUS_ACTIVE);
    }

    // ── Round 0 ──────────────────────────────────────────────────────────────

    function test_Round0_ContributeAll_HasPaidFlags() public {
        _contributeAll(potId);

        assertEq(turnpot.hasPaid(potId, 0, alice), true);
        assertEq(turnpot.hasPaid(potId, 0, bob),   true);
        assertEq(turnpot.hasPaid(potId, 0, carol),  true);
        assertEq(turnpot.hasPaid(potId, 0, dave),   true);
        assertEq(turnpot.paidCount(potId), 4);
    }

    function test_Round0_CloseRound_CreditsMember0() public {
        _contributeAll(potId);
        turnpot.closeRound(potId);

        // alice (index 0) should receive 4 × 0.1 ether
        assertEq(turnpot.balanceOf(alice), 4 * CONTRIBUTION);
        assertEq(_currentRound(potId), 1);
        assertEq(uint8(_status(potId)), STATUS_ACTIVE);
    }

    function test_Round0_CloseRound_EmitsRoundClosed() public {
        _contributeAll(potId);

        vm.expectEmit(true, false, true, true, address(turnpot));
        emit TurnPot.RoundClosed(potId, 0, alice, 4 * CONTRIBUTION);
        turnpot.closeRound(potId);
    }

    function test_Round0_Withdraw_AliceGetsExactAmount() public {
        _contributeAll(potId);
        turnpot.closeRound(potId);

        uint256 before = alice.balance;
        vm.prank(alice);
        turnpot.withdraw();

        assertEq(alice.balance - before, 4 * CONTRIBUTION);
        assertEq(turnpot.balanceOf(alice), 0);
    }

    function test_Round0_SecondWithdraw_Reverts() public {
        _contributeAll(potId);
        turnpot.closeRound(potId);

        vm.prank(alice);
        turnpot.withdraw();

        vm.prank(alice);
        vm.expectRevert(TurnPot.NothingToWithdraw.selector);
        turnpot.withdraw();
    }

    function test_Round0_WithdrawEmitsEvent() public {
        _contributeAll(potId);
        turnpot.closeRound(potId);

        vm.expectEmit(true, false, false, true, address(turnpot));
        emit TurnPot.Withdrawn(alice, 4 * CONTRIBUTION);
        vm.prank(alice);
        turnpot.withdraw();
    }

    // ── Full 4-round lifecycle ────────────────────────────────────────────────

    function test_FullLifecycle_AllRounds() public {
        address[4] memory members = [alice, bob, carol, dave];

        for (uint256 r = 0; r < 4; r++) {
            assertEq(_currentRound(potId), r);
            assertEq(uint8(_status(potId)), STATUS_ACTIVE);

            _contributeAll(potId);
            assertEq(turnpot.paidCount(potId), 4);

            turnpot.closeRound(potId);

            // payout credited to the recipient of this round
            address recipient = members[r];
            assertEq(turnpot.balanceOf(recipient), 4 * CONTRIBUTION);

            // recipient withdraws
            uint256 before = recipient.balance;
            vm.prank(recipient);
            turnpot.withdraw();
            assertEq(recipient.balance - before, 4 * CONTRIBUTION);
            assertEq(turnpot.balanceOf(recipient), 0);

            // after the last round, advance time so next round starts
            if (r < 3) {
                // roundStart is updated by closeRound; no warp needed here
            }
        }

        // Final state
        assertEq(uint8(_status(potId)), STATUS_COMPLETED);
        assertEq(_currentRound(potId), 4);
        assertEq(address(turnpot).balance, 0);
        assertEq(turnpot.potCount(), 1);
    }

    function test_FullLifecycle_CurrentRoundProgression() public {
        // Track currentRound after each closeRound
        _contributeAll(potId);
        turnpot.closeRound(potId);
        assertEq(_currentRound(potId), 1);

        _contributeAll(potId);
        turnpot.closeRound(potId);
        assertEq(_currentRound(potId), 2);

        _contributeAll(potId);
        turnpot.closeRound(potId);
        assertEq(_currentRound(potId), 3);

        _contributeAll(potId);
        turnpot.closeRound(potId);
        assertEq(_currentRound(potId), 4); // past last index → Completed
    }

    function test_FullLifecycle_StatusCompletedAtEnd() public {
        for (uint256 r = 0; r < 4; r++) {
            _contributeAll(potId);
            turnpot.closeRound(potId);
        }
        assertEq(uint8(_status(potId)), STATUS_COMPLETED);
    }

    function test_FullLifecycle_ContractBalanceZeroAfterAllWithdrawals() public {
        address[4] memory members = [alice, bob, carol, dave];

        for (uint256 r = 0; r < 4; r++) {
            _contributeAll(potId);
            turnpot.closeRound(potId);
            vm.prank(members[r]);
            turnpot.withdraw();
        }

        assertEq(address(turnpot).balance, 0);
    }
}
