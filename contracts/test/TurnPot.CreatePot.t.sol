// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TurnPotTestBase} from "./TurnPot.Base.t.sol";
import {TurnPot} from "../TurnPot.sol";

/// @dev Test 14 — createPot validation failures and boundary values.
contract TurnPotCreatePotTest is TurnPotTestBase {

    // ── Member count validation ───────────────────────────────────────────────

    function test_CreatePot_OneMember_Reverts() public {
        address[] memory m = new address[](1);
        m[0] = alice;
        vm.expectRevert(TurnPot.InvalidMembers.selector);
        turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
    }

    function test_CreatePot_ElevenMembers_Reverts() public {
        address[] memory m = new address[](11);
        for (uint256 i = 0; i < 11; i++) {
            m[i] = vm.addr(i + 1);
        }
        vm.expectRevert(TurnPot.InvalidMembers.selector);
        turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
    }

    function test_CreatePot_TwoMembers_Succeeds() public {
        address[] memory m = new address[](2);
        m[0] = alice;
        m[1] = bob;
        vm.prank(alice);
        uint256 id = turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
        assertEq(id, 0);
        assertEq(turnpot.potCount(), 1);
    }

    function test_CreatePot_TenMembers_Succeeds() public {
        address[] memory m = new address[](10);
        for (uint256 i = 0; i < 10; i++) {
            m[i] = vm.addr(i + 1);
        }
        vm.prank(m[0]);
        uint256 id = turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
        assertEq(id, 0);
    }

    // ── Duplicate & zero address ──────────────────────────────────────────────

    function test_CreatePot_DuplicateMember_Reverts() public {
        address[] memory m = new address[](3);
        m[0] = alice;
        m[1] = bob;
        m[2] = alice; // duplicate
        vm.expectRevert(TurnPot.InvalidMembers.selector);
        turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
    }

    function test_CreatePot_ZeroAddress_Reverts() public {
        address[] memory m = new address[](2);
        m[0] = alice;
        m[1] = address(0);
        vm.expectRevert(TurnPot.InvalidMembers.selector);
        turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
    }

    // ── Contribution validation ───────────────────────────────────────────────

    function test_CreatePot_ZeroContribution_Reverts() public {
        vm.expectRevert(TurnPot.InvalidContribution.selector);
        turnpot.createPot(_fourMembers(), 0, ROUND_DURATION);
    }

    function test_CreatePot_ContributionAboveMax_Reverts() public {
        uint256 overMax = turnpot.MAX_CONTRIBUTION() + 1;
        vm.expectRevert(TurnPot.InvalidContribution.selector);
        turnpot.createPot(_fourMembers(), overMax, ROUND_DURATION);
    }

    function test_CreatePot_MaxContribution_Succeeds() public {
        uint256 maxContrib = turnpot.MAX_CONTRIBUTION();
        vm.prank(alice);
        uint256 id = turnpot.createPot(_fourMembers(), maxContrib, ROUND_DURATION);
        (,uint256 c,,,,) = turnpot.getPot(id);
        assertEq(c, maxContrib);
    }

    // ── Duration validation ───────────────────────────────────────────────────

    function test_CreatePot_Duration59_Reverts() public {
        vm.expectRevert(TurnPot.InvalidDuration.selector);
        turnpot.createPot(_fourMembers(), CONTRIBUTION, 59);
    }

    function test_CreatePot_Duration60_Succeeds() public {
        vm.prank(alice);
        uint256 id = turnpot.createPot(_fourMembers(), CONTRIBUTION, 60);
        (,,uint256 dur,,,) = turnpot.getPot(id);
        assertEq(dur, 60);
    }

    // ── potCount increments ───────────────────────────────────────────────────

    function test_CreatePot_MultiplePots_PotCountIncrements() public {
        address[] memory m2 = new address[](2);
        m2[0] = alice;
        m2[1] = bob;

        address[] memory m3 = new address[](2);
        m3[0] = carol;
        m3[1] = dave;

        vm.prank(alice);
        uint256 id0 = turnpot.createPot(m2, CONTRIBUTION, ROUND_DURATION);
        vm.prank(carol);
        uint256 id1 = turnpot.createPot(m3, CONTRIBUTION, ROUND_DURATION);

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(turnpot.potCount(), 2);
    }

    // ── PotCreated event ─────────────────────────────────────────────────────

    function test_CreatePot_EmitsPotCreated() public {
        address[] memory m = _fourMembers();
        vm.expectEmit(true, false, false, true, address(turnpot));
        emit TurnPot.PotCreated(0, m, CONTRIBUTION, ROUND_DURATION);
        vm.prank(alice);
        turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);
    }
}
