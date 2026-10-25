// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TurnPotTestBase} from "./TurnPot.Base.t.sol";
import {TurnPot} from "../TurnPot.sol";

/// @dev Malicious receiver that tries to re-enter withdraw() in its receive() hook.
contract MaliciousReceiver {
    TurnPot public pot;
    uint256 public attackCount;

    constructor(TurnPot _pot) {
        pot = _pot;
    }

    /// Allow tests to top-up this contract's ETH balance so it can contribute.
    receive() external payable {
        attackCount++;
        if (attackCount < 3) {
            // Try to re-enter; should revert due to nonReentrant guard
            // OR find balanceOf == 0 after CEI — both are acceptable.
            try pot.withdraw() {} catch {}
        }
    }

    /// Proxy: contribute to the pot on behalf of this contract.
    function contribute(uint256 potId, uint256 amount) external {
        pot.contribute{value: amount}(potId);
    }

    /// Trigger the withdraw.
    function attack() external {
        pot.withdraw();
    }
}

/// @dev Test 13 — reentrancy attack.
contract TurnPotReentrancyTest is TurnPotTestBase {

    MaliciousReceiver internal attacker;
    uint256           internal potId;

    /// Pot: [attacker, alice, bob, carol] — attacker is member[0], recipient of round 0.
    function setUp() public override {
        super.setUp();

        attacker = new MaliciousReceiver(turnpot);
        vm.label(address(attacker), "attacker");
        vm.deal(address(attacker), 100 ether);

        // Build member array: attacker first (index 0 → gets round-0 payout)
        address[] memory m = new address[](4);
        m[0] = address(attacker);
        m[1] = alice;
        m[2] = bob;
        m[3] = carol;

        vm.prank(address(attacker));
        potId = turnpot.createPot(m, CONTRIBUTION, ROUND_DURATION);

        // All members contribute for round 0
        attacker.contribute(potId, CONTRIBUTION);
        vm.prank(alice);
        turnpot.contribute{value: CONTRIBUTION}(potId);
        vm.prank(bob);
        turnpot.contribute{value: CONTRIBUTION}(potId);
        vm.prank(carol);
        turnpot.contribute{value: CONTRIBUTION}(potId);

        // Close round 0 — credits attacker with 4 × CONTRIBUTION
        turnpot.closeRound(potId);
    }

    function test_Reentrancy_AttackerReceivesExactlyOnePayout() public {
        uint256 expectedPayout = 4 * CONTRIBUTION;
        assertEq(turnpot.balanceOf(address(attacker)), expectedPayout);

        uint256 contractBefore = address(turnpot).balance;
        uint256 attackerBefore = address(attacker).balance;

        attacker.attack();

        uint256 attackerReceived = address(attacker).balance - attackerBefore;

        // Attacker received exactly one legitimate payout — no extra funds drained
        assertEq(attackerReceived, expectedPayout);

        // TurnPot balance decreased by exactly one payout
        assertEq(address(turnpot).balance, contractBefore - expectedPayout);
    }

    function test_Reentrancy_BalanceZeroedAfterWithdraw() public {
        attacker.attack();
        assertEq(turnpot.balanceOf(address(attacker)), 0);
    }

    function test_Reentrancy_ContractBalanceNonNegativeAfterAllWithdrawals() public {
        // attacker withdraws
        attacker.attack();

        // remaining members complete rounds 1-3, then each withdraws
        address[3] memory rest = [alice, bob, carol];
        for (uint256 r = 1; r < 4; r++) {
            // All 4 members contribute (attacker included for remaining rounds)
            attacker.contribute(potId, CONTRIBUTION);
            vm.prank(alice);
            turnpot.contribute{value: CONTRIBUTION}(potId);
            vm.prank(bob);
            turnpot.contribute{value: CONTRIBUTION}(potId);
            vm.prank(carol);
            turnpot.contribute{value: CONTRIBUTION}(potId);

            turnpot.closeRound(potId);

            address recipient = rest[r - 1];
            vm.prank(recipient);
            turnpot.withdraw();
        }

        assertEq(address(turnpot).balance, 0);
    }
}
