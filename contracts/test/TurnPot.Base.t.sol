// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TurnPot} from "../TurnPot.sol";

/// @dev Shared setup, constants, and helpers reused by all TurnPot test categories.
abstract contract TurnPotTestBase is Test {
    TurnPot internal turnpot;

    // 4-member fixture addresses
    address internal alice;
    address internal bob;
    address internal carol;
    address internal dave;

    uint256 internal constant CONTRIBUTION = 0.1 ether;
    uint256 internal constant ROUND_DURATION = 300;

    // Expose enum values as constants for clarity
    uint8 internal constant STATUS_ACTIVE    = 0;
    uint8 internal constant STATUS_COMPLETED = 1;
    uint8 internal constant STATUS_CANCELLED = 2;

    function setUp() public virtual {
        turnpot = new TurnPot();

        alice = makeAddr("alice");
        bob   = makeAddr("bob");
        carol = makeAddr("carol");
        dave  = makeAddr("dave");

        vm.label(address(turnpot), "TurnPot");
        vm.label(alice, "alice");
        vm.label(bob,   "bob");
        vm.label(carol, "carol");
        vm.label(dave,  "dave");

        vm.deal(alice, 100 ether);
        vm.deal(bob,   100 ether);
        vm.deal(carol, 100 ether);
        vm.deal(dave,  100 ether);
    }

    // ─────────────────────────── helpers ────────────────────────────────────

    /// Build a 4-member array [alice, bob, carol, dave].
    function _fourMembers() internal view returns (address[] memory m) {
        m = new address[](4);
        m[0] = alice;
        m[1] = bob;
        m[2] = carol;
        m[3] = dave;
    }

    /// Create the default 4-member pot; returns potId (always 0 on a fresh deployment).
    /// alice is pranked as msg.sender because she is members[0] (satisfies CreatorNotMember).
    function _createDefaultPot() internal returns (uint256 potId) {
        vm.prank(alice);
        potId = turnpot.createPot(_fourMembers(), CONTRIBUTION, ROUND_DURATION);
    }

    /// Have all four members contribute to the current round.
    function _contributeAll(uint256 potId) internal {
        address[4] memory members = [alice, bob, carol, dave];
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(members[i]);
            turnpot.contribute{value: CONTRIBUTION}(potId);
        }
    }

    /// Decode the Status field from getPot.
    function _status(uint256 potId) internal view returns (TurnPot.Status) {
        (,,,,,TurnPot.Status s) = turnpot.getPot(potId);
        return s;
    }

    /// Decode currentRound from getPot.
    function _currentRound(uint256 potId) internal view returns (uint256) {
        (,,,uint256 r,,) = turnpot.getPot(potId);
        return r;
    }

    /// Decode roundStart from getPot.
    function _roundStart(uint256 potId) internal view returns (uint256) {
        (,,,,uint256 rs,) = turnpot.getPot(potId);
        return rs;
    }
}
