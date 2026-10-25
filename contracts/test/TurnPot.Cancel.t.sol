// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TurnPotTestBase} from "./TurnPot.Base.t.sol";
import {TurnPot} from "../TurnPot.sol";

/// @dev Test 10 — cancelRound: partial payment full lifecycle.
contract TurnPotCancelTest is TurnPotTestBase {
    uint256 internal potId;

    function setUp() public override {
        super.setUp();
        potId = _createDefaultPot();
    }

    function test_CancelRound_PartialPayment_RefundsPayers() public {
        // alice and bob pay; carol and dave don't
        vm.prank(alice);
        turnpot.contribute{value: CONTRIBUTION}(potId);
        vm.prank(bob);
        turnpot.contribute{value: CONTRIBUTION}(potId);

        uint256 deadline = turnpot.roundDeadline(potId);
        vm.warp(deadline + 1);

        vm.expectEmit(true, false, false, true, address(turnpot));
        emit TurnPot.RoundCancelled(potId, 0);
        turnpot.cancelRound(potId);

        // Status → Cancelled
        assertEq(uint8(_status(potId)), STATUS_CANCELLED);

        // Payers get refunded
        assertEq(turnpot.balanceOf(alice), CONTRIBUTION);
        assertEq(turnpot.balanceOf(bob),   CONTRIBUTION);

        // Non-payers get defaults incremented
        assertEq(turnpot.defaults(carol), 1);
        assertEq(turnpot.defaults(dave),  1);

        // Payers can withdraw their refund
        uint256 aliceBefore = alice.balance;
        vm.prank(alice);
        turnpot.withdraw();
        assertEq(alice.balance - aliceBefore, CONTRIBUTION);
        assertEq(turnpot.balanceOf(alice), 0);

        uint256 bobBefore = bob.balance;
        vm.prank(bob);
        turnpot.withdraw();
        assertEq(bob.balance - bobBefore, CONTRIBUTION);
        assertEq(turnpot.balanceOf(bob), 0);
    }

    function test_CancelRound_NonPayerDefaultsIncrement() public {
        // Only alice pays
        vm.prank(alice);
        turnpot.contribute{value: CONTRIBUTION}(potId);

        uint256 deadline = turnpot.roundDeadline(potId);
        vm.warp(deadline + 1);
        turnpot.cancelRound(potId);

        assertEq(turnpot.defaults(bob),   1);
        assertEq(turnpot.defaults(carol),  1);
        assertEq(turnpot.defaults(dave),   1);
        assertEq(turnpot.defaults(alice),  0); // alice paid, no default
    }

    function test_CancelRound_FurtherContributeReverts() public {
        uint256 deadline = turnpot.roundDeadline(potId);
        vm.warp(deadline + 1);
        turnpot.cancelRound(potId);

        vm.prank(alice);
        vm.expectRevert(TurnPot.PotNotActive.selector);
        turnpot.contribute{value: CONTRIBUTION}(potId);
    }

    function test_CancelRound_OnlyOnePayer_ContractBalanceCorrect() public {
        // alice pays, rest don't
        vm.prank(alice);
        turnpot.contribute{value: CONTRIBUTION}(potId);

        uint256 deadline = turnpot.roundDeadline(potId);
        vm.warp(deadline + 1);
        turnpot.cancelRound(potId);

        // Contract holds exactly 1 × CONTRIBUTION (alice's refund pending)
        assertEq(address(turnpot).balance, CONTRIBUTION);

        vm.prank(alice);
        turnpot.withdraw();

        assertEq(address(turnpot).balance, 0);
    }

    function test_CancelRound_NoPayersAtAll_DefaultsAll() public {
        uint256 deadline = turnpot.roundDeadline(potId);
        vm.warp(deadline + 1);
        turnpot.cancelRound(potId);

        // All members default
        assertEq(turnpot.defaults(alice), 1);
        assertEq(turnpot.defaults(bob),   1);
        assertEq(turnpot.defaults(carol), 1);
        assertEq(turnpot.defaults(dave),  1);

        // No balances credited
        assertEq(turnpot.balanceOf(alice), 0);
        assertEq(turnpot.balanceOf(bob),   0);
        assertEq(turnpot.balanceOf(carol), 0);
        assertEq(turnpot.balanceOf(dave),  0);

        assertEq(address(turnpot).balance, 0);
    }
}
