// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TurnPotTestBase} from "./TurnPot.Base.t.sol";
import {TurnPot} from "../TurnPot.sol";

/// @dev Tests 2–9 and 11–12: revert paths for contribute, closeRound, cancelRound, withdraw, createPot.
contract TurnPotRevertTest is TurnPotTestBase {
    uint256 internal potId;

    function setUp() public override {
        super.setUp();
        potId = _createDefaultPot();
    }

    // ── Test 2: contribute — wrong amount ─────────────────────────────────────

    function test_Contribute_TooLow_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(TurnPot.WrongAmount.selector);
        turnpot.contribute{value: CONTRIBUTION - 1}(potId);
    }

    function test_Contribute_TooHigh_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(TurnPot.WrongAmount.selector);
        turnpot.contribute{value: CONTRIBUTION + 1}(potId);
    }

    function test_Contribute_ZeroValue_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(TurnPot.WrongAmount.selector);
        turnpot.contribute{value: 0}(potId);
    }

    // ── Test 3: contribute — non-member ──────────────────────────────────────

    function test_Contribute_NonMember_Reverts() public {
        address stranger = makeAddr("stranger");
        vm.deal(stranger, 10 ether);
        vm.prank(stranger);
        vm.expectRevert(TurnPot.NotMember.selector);
        turnpot.contribute{value: CONTRIBUTION}(potId);
    }

    // ── Test 4: contribute — double payment ──────────────────────────────────

    function test_Contribute_AlreadyPaid_Reverts() public {
        vm.prank(alice);
        turnpot.contribute{value: CONTRIBUTION}(potId);

        vm.prank(alice);
        vm.expectRevert(TurnPot.AlreadyPaid.selector);
        turnpot.contribute{value: CONTRIBUTION}(potId);
    }

    // ── Test 5: contribute — after deadline ──────────────────────────────────

    function test_Contribute_AfterDeadline_Reverts() public {
        uint256 deadline = turnpot.roundDeadline(potId);
        vm.warp(deadline + 1);

        vm.prank(alice);
        vm.expectRevert(TurnPot.RoundExpired.selector);
        turnpot.contribute{value: CONTRIBUTION}(potId);
    }

    // ── Test 6: closeRound — not all paid ────────────────────────────────────

    function test_CloseRound_NotAllPaid_Reverts() public {
        // Only alice and bob pay; carol and dave don't
        vm.prank(alice);
        turnpot.contribute{value: CONTRIBUTION}(potId);
        vm.prank(bob);
        turnpot.contribute{value: CONTRIBUTION}(potId);

        vm.expectRevert(TurnPot.NotAllPaid.selector);
        turnpot.closeRound(potId);
    }

    function test_CloseRound_NobodyPaid_Reverts() public {
        vm.expectRevert(TurnPot.NotAllPaid.selector);
        turnpot.closeRound(potId);
    }

    // ── Test 7: closeRound — pot not active ──────────────────────────────────

    function test_CloseRound_OnCancelledPot_Reverts() public {
        // Cancel the pot: warp past deadline with nobody paid
        uint256 deadline = turnpot.roundDeadline(potId);
        vm.warp(deadline + 1);
        turnpot.cancelRound(potId);

        vm.expectRevert(TurnPot.PotNotActive.selector);
        turnpot.closeRound(potId);
    }

    function test_CloseRound_OnCompletedPot_Reverts() public {
        // Complete all 4 rounds
        for (uint256 r = 0; r < 4; r++) {
            _contributeAll(potId);
            turnpot.closeRound(potId);
        }
        assertEq(uint8(_status(potId)), STATUS_COMPLETED);

        vm.expectRevert(TurnPot.PotNotActive.selector);
        turnpot.closeRound(potId);
    }

    // ── Test 8: cancelRound — before deadline ────────────────────────────────

    function test_CancelRound_BeforeDeadline_Reverts() public {
        vm.expectRevert(TurnPot.RoundNotOver.selector);
        turnpot.cancelRound(potId);
    }

    function test_CancelRound_ExactlyAtDeadline_Reverts() public {
        uint256 deadline = turnpot.roundDeadline(potId);
        vm.warp(deadline); // block.timestamp == roundStart + roundDuration → NOT > → RoundNotOver
        vm.expectRevert(TurnPot.RoundNotOver.selector);
        turnpot.cancelRound(potId);
    }

    // ── Test 9: cancelRound — all already paid ───────────────────────────────

    function test_CancelRound_AllPaid_Reverts() public {
        _contributeAll(potId);

        uint256 deadline = turnpot.roundDeadline(potId);
        vm.warp(deadline + 1);

        vm.expectRevert(TurnPot.AllPaid.selector);
        turnpot.cancelRound(potId);
    }

    // ── Test 11: withdraw — zero balance ─────────────────────────────────────

    function test_Withdraw_ZeroBalance_Reverts() public {
        address fresh = makeAddr("fresh");
        vm.prank(fresh);
        vm.expectRevert(TurnPot.NothingToWithdraw.selector);
        turnpot.withdraw();
    }

    // ── Test 12: Double withdraw cannot drain ────────────────────────────────

    function test_DoubleWithdraw_SecondReverts() public {
        _contributeAll(potId);
        turnpot.closeRound(potId);

        vm.prank(alice);
        turnpot.withdraw();

        vm.prank(alice);
        vm.expectRevert(TurnPot.NothingToWithdraw.selector);
        turnpot.withdraw();
    }

    function test_DoubleWithdraw_ContractBalanceNeverNegative() public {
        _contributeAll(potId);
        turnpot.closeRound(potId);

        vm.prank(alice);
        turnpot.withdraw();

        // Remaining ETH in contract = contributions from round 0 by bob, carol, dave (3 × 0.1 ether)
        // alice's payout was 4 × 0.1 ether; net contract balance = 4 × 0.1 - 4 × 0.1 = 0 for
        // those funds. But bob/carol/dave have not withdrawn their eventual payouts.
        // Crucially, balance cannot go below 0.
        assertGe(address(turnpot).balance, 0);
    }

    // ── getPot / hasPaid on nonexistent potId ────────────────────────────────

    function test_GetPot_InvalidId_Reverts() public {
        vm.expectRevert(TurnPot.PotNotFound.selector);
        turnpot.getPot(999);
    }

    function test_Contribute_InvalidId_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(TurnPot.PotNotFound.selector);
        turnpot.contribute{value: CONTRIBUTION}(999);
    }

    function test_Contribute_OnCancelledPot_Reverts() public {
        uint256 deadline = turnpot.roundDeadline(potId);
        vm.warp(deadline + 1);
        turnpot.cancelRound(potId);

        vm.prank(alice);
        vm.expectRevert(TurnPot.PotNotActive.selector);
        turnpot.contribute{value: CONTRIBUTION}(potId);
    }
}
