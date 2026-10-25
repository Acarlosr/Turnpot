// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TurnPotTestBase} from "./TurnPot.Base.t.sol";
import {TurnPot} from "../TurnPot.sol";

/// @dev Test 15 — fuzz: conservation of value across arbitrary member counts and contributions.
contract TurnPotFuzzTest is TurnPotTestBase {

    /// @notice For any valid memberCount and contribution, total withdrawn == total contributed.
    function testFuzz_ConservationOfValue(uint8 memberCount, uint96 contribution) public {
        // ── bound inputs ──────────────────────────────────────────────────────
        uint256 n = bound(uint256(memberCount), 2, 10);
        uint256 c = bound(uint256(contribution), 1, turnpot.MAX_CONTRIBUTION());

        // ── build member array with unique funded addresses ───────────────────
        address[] memory members = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            // vm.addr(seed) needs seed > 0; use i+1 offset, add large salt to avoid
            // collision with foundry's own pre-computed addresses.
            members[i] = vm.addr(0xDEAD + i + 1);
            vm.label(members[i], string(abi.encodePacked("fuzz_member_", i)));
            // Each member needs enough ETH to pay in every round (n rounds × c each)
            vm.deal(members[i], n * c + 1 ether);
        }

        // ── create pot ────────────────────────────────────────────────────────
        // members[0] is the creator; prank so CreatorNotMember check passes.
        vm.prank(members[0]);
        uint256 potId = turnpot.createPot(members, c, ROUND_DURATION);

        // ── simulate all rounds ───────────────────────────────────────────────
        for (uint256 r = 0; r < n; r++) {
            // All members contribute
            for (uint256 i = 0; i < n; i++) {
                vm.prank(members[i]);
                turnpot.contribute{value: c}(potId);
            }
            turnpot.closeRound(potId);
        }

        // Status must be Completed
        assertEq(uint8(_status(potId)), STATUS_COMPLETED);

        // ── all members withdraw ──────────────────────────────────────────────
        uint256 totalWithdrawn = 0;
        for (uint256 i = 0; i < n; i++) {
            uint256 bal = turnpot.balanceOf(members[i]);
            assertEq(bal, n * c, "each recipient gets n * c");
            uint256 before = members[i].balance;
            vm.prank(members[i]);
            turnpot.withdraw();
            totalWithdrawn += members[i].balance - before;
        }

        // Total ETH contributed == n * n * c
        uint256 totalContributed = n * n * c;
        assertEq(totalWithdrawn, totalContributed, "conservation: withdrawn == contributed");

        // Contract balance == 0
        assertEq(address(turnpot).balance, 0, "contract drained to zero");
    }

    /// @notice Fuzz the deadline boundary: contributing exactly at deadline timestamp is valid,
    ///         contributing one second after deadline reverts RoundExpired.
    function testFuzz_DeadlineBoundary(uint32 duration, uint32 warpOffset) public {
        // Duration must be >= 60
        uint256 dur = bound(uint256(duration), 60, 3600);

        address[] memory m = new address[](2);
        m[0] = alice;
        m[1] = bob;

        vm.prank(alice);
        uint256 potId = turnpot.createPot(m, CONTRIBUTION, dur);
        uint256 deadline = turnpot.roundDeadline(potId);

        // warpOffset: 0 = at deadline, 1 = one second after
        uint256 offset = bound(uint256(warpOffset), 0, 1);
        vm.warp(deadline + offset);

        if (offset == 0) {
            // Exactly at deadline: block.timestamp == roundStart + roundDuration → allowed
            vm.prank(alice);
            turnpot.contribute{value: CONTRIBUTION}(potId);
            assertTrue(turnpot.hasPaid(potId, 0, alice));
        } else {
            // One second past deadline: reverts
            vm.prank(alice);
            vm.expectRevert(TurnPot.RoundExpired.selector);
            turnpot.contribute{value: CONTRIBUTION}(potId);
        }
    }

    /// @notice Fuzz contribution boundary: exact amount succeeds, off-by-one reverts.
    function testFuzz_WrongAmount(uint96 rawContrib, uint96 sent) public {
        uint256 c = bound(uint256(rawContrib), 1, turnpot.MAX_CONTRIBUTION());
        // Make sent != c
        vm.assume(uint256(sent) != c);
        vm.deal(alice, type(uint128).max);

        address[] memory m = new address[](2);
        m[0] = alice;
        m[1] = bob;

        vm.prank(alice);
        uint256 potId = turnpot.createPot(m, c, ROUND_DURATION);

        vm.prank(alice);
        vm.expectRevert(TurnPot.WrongAmount.selector);
        turnpot.contribute{value: uint256(sent)}(potId);
    }
}
