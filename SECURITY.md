# TurnPot Security Review

This document records the findings from a security review of `contracts/TurnPot.sol`, the fixes applied, the known limitations that are documented but not patched, and the reasoning behind every decision.

Review scope: reentrancy, rounding, stuck funds, griefing, denial of service, timestamp assumptions, and non-payable member addresses.

---

## Fixed Issues

### 1. Unconsented membership default griefing (High)

**What was wrong.**
`createPot` was permissionless: any caller could list arbitrary addresses as members without their consent. Because `cancelRound` increments `defaults[member]` for every member who did not pay when the round deadline passes, an attacker could create an unlimited number of pots containing victim addresses, abandon them, and call `cancelRound` on each one — permanently inflating victims' `defaults` counters at zero cost to the attacker.

The `defaults` mapping is public and queryable by anyone building off-chain scoring, gating, or reputation systems. A victim would have no way to remove the spurious entries.

**Fix applied.**
`createPot` now requires `msg.sender` to be one of the listed members. If the caller is not in the array, the transaction reverts with `CreatorNotMember`.

This closes the free-lunch vector: an attacker who wants to inflate a victim's defaults must now be a member of the same pot, which means they must fund their own contribution each round or lose that money when `cancelRound` is called. The attack becomes expensive rather than free.

**What this does not prevent.**
A determined attacker who IS a legitimate member in the same pot as a victim can still cause `defaults[victim]` to increment — once per cancelled round of that pot — if they stop paying. This is an inherent property of the ROSCA model and is documented below under Known Limitations.

**Test file:** `contracts/test/TurnPot.SecurityFixes.t.sol`
Relevant tests: `test_createPot_creatorNotMember_reverts`, `test_griefing_cannotInflateDefaultsForVictim`, `test_createPot_creatorIsFirstMember_succeeds`, `test_createPot_creatorIsLastMember_succeeds`, `test_createPot_creatorIsMiddleMember_succeeds`.

---

### 2. Non-payable member address — stuck funds (Medium)

**What was wrong.**
`withdraw()` sends native value to `msg.sender` via a low-level call. If `msg.sender` is a smart contract without a payable `receive()` or `fallback()`, the transfer reverts and the call fails. The member's `balanceOf` entry would be written to zero, the transfer would fail, and the whole transaction would revert — leaving the balance intact but permanently unclaimable, because every subsequent `withdraw()` call hits the same revert.

In practice this affects:
- Smart contract wallets or multisigs that do not accept native value.
- Contracts deployed as ROSCA members for automation purposes.
- Any address whose receive hook reverts (e.g. a guard that blocks unexpected native transfers).

The pot's ETH would be permanently locked with no admin rescue path.

**Fix applied.**
A new function `withdrawTo(address payable recipient)` lets the caller send their balance to any non-zero address they specify. The caller's `balanceOf[msg.sender]` is still what is consumed (the caller must own the balance — no delegation), but the native transfer goes to `recipient` instead. This lets a non-payable contract member designate an EOA or a payable contract as its withdrawal target.

`withdrawTo` applies the same protections as `withdraw()`: `nonReentrant`, checks-effects-interactions (balance zeroed before the external call), and a zero-address guard (`InvalidRecipient`).

**Test file:** `contracts/test/TurnPot.SecurityFixes.t.sol`
Relevant tests: `test_withdrawTo_nonPayableMemberCanWithdrawToEOA`, `test_withdrawTo_reverts_zeroRecipient`, `test_withdrawTo_reverts_noBalance`, `test_withdrawTo_emitsWithdrawnTo`, `test_withdrawTo_cannotDoubleWithdraw`, `test_withdrawTo_reentrancyBlocked`.

---

## Areas Reviewed and Found Sound

### Reentrancy

Both `withdraw()` and `withdrawTo()` are `nonReentrant` (OpenZeppelin `ReentrancyGuard`) and follow strict checks-effects-interactions: the balance is zeroed before the external call in both functions. A reentering call finds `balanceOf[msg.sender] == 0` and reverts `NothingToWithdraw`. Reentrancy via `receive()` is blocked by both the guard and the zero-balance check. Tested in `TurnPot.Reentrancy.t.sol` and `TurnPot.SecurityFixes.t.sol`.

### Rounding

The payout amount is `contribution * members.length`. Both operands are `uint256`; `contribution` is at most `1 ether` (1e18) and `members.length` is at most 10, giving a maximum product of 1e19 — well within `uint256`. No division occurs anywhere in the contract, so there is no truncation or precision loss. The invariant `address(this).balance >= sum(balanceOf)` is maintained by construction: ETH enters only through `contribute()` (exact `msg.value == contribution`), and exits only through `withdraw()`/`withdrawTo()` after balances are credited by `closeRound` or `cancelRound`.

### Stuck funds — cancelled or completed pots

When a pot is Cancelled, refunds are credited to `balanceOf[member]` (pull payment). When a pot is Completed, payouts are credited to `balanceOf[member]` the same way. No ETH is held "in" the pot struct itself — all ETH lives in the contract's global balance, offset by `balanceOf` entries. A member who never calls `withdraw()` leaves their balance in the contract indefinitely, but this does not affect other members: their own `balanceOf` entries are independent. There is no sweep, no expiry, and no admin. This is a conscious design choice: unclaimed balances cannot be taken by anyone other than the member who earned them.

### Denial of service on `closeRound` and `cancelRound`

Neither `closeRound` nor `cancelRound` pushes ETH to any member during execution. Both are purely bookkeeping: they update `balanceOf` entries (in-storage integer increments). There is no external call inside either function. A member with a reverting `receive()` cannot block either function.

The only way to block `closeRound` is for at least one member not to pay, which causes it to revert `NotAllPaid` — this is by design and is the trigger for `cancelRound` instead. The only way to block `cancelRound` is if the deadline has not passed or all members paid, both of which are also by design.

No single address — member or outsider — can permanently prevent a round from eventually being closeable or cancellable.

### Timestamp assumptions

`contribute` rejects contributions after `roundStart + roundDuration` (using `>`). `cancelRound` requires `block.timestamp > roundStart + roundDuration` (strictly after). Validators can shift `block.timestamp` by approximately ±15 seconds on proof-of-stake chains. The minimum `roundDuration` is 60 seconds, so a 15-second drift represents at most 25% of the shortest possible round. In the worst case a validator could allow a contribution to land one block past the "true" deadline, or deny one that is technically on time. This is an accepted property of all time-based Solidity contracts. The 60-second minimum provides a meaningful buffer. For higher-value deployments, a longer `roundDuration` (hours or days, as is normal for real ROSCAs) makes the ±15-second drift negligible.

There is no overflow risk in `roundStart + roundDuration` because both are `uint256` and realistic durations (seconds to weeks) are far below `type(uint256).max`.

### Non-payable member and `closeRound`/`cancelRound`

As noted above, neither `closeRound` nor `cancelRound` transfers ETH — they only increment `balanceOf` entries. A non-payable member address does not cause any problems at the pot level. The member can use `withdrawTo` to rescue their credited balance to a payable address.

---

## Known Limitations

### Early recipient can stop paying in later rounds

**Description.**
Payout order is fixed at creation time: `members[0]` receives the pot in round 0, `members[1]` in round 1, and so on. Once `members[i]` has received their payout (and withdrawn it from `balanceOf`), they have no on-chain incentive to continue paying in rounds `i+1` through `members.length - 1`. If they stop paying, those later rounds will time out, `cancelRound` will fire, payers in those rounds get refunds, and the earlier recipients' `defaults` counters increment — but the already-disbursed payout cannot be recovered. The remaining members who had not yet received their turn lose only their time (their contributions are refunded); they do not lose principal.

**Why this is not fixed.**
Recovering a previously disbursed payout would require either (a) a clawback mechanism that can seize or freeze balances — incompatible with the contract's no-admin, no-custody philosophy — or (b) requiring members to lock collateral at creation — a significant change to the economic model. The ROSCA model in all its real-world forms relies on social trust and repeated-game incentives, not on-chain enforcement of post-payout obligations. The contract faithfully implements the ROSCA model; the limitation is inherent to that model.

**Mitigation.**
The `defaults(address)` view exposes each member's default count. Off-chain tooling and frontends should surface this data before a user agrees to join a pot with a member who has prior defaults. Pot creators and members are responsible for selecting trustworthy participants.

### Members with high defaults can continue joining new pots

The `defaults` mapping records but does not gate. A member with many defaults can still be listed in a new pot (as long as they are also the creator or another member creates the pot). There is no on-chain blacklist. Enforcement is off-chain.

### No on-chain dispute resolution

If members disagree about whether a contribution was made (e.g. a front-end error, a race between contribute and cancelRound), the contract's state is authoritative. There is no appeal, no admin override, and no pause mechanism. The `hasPaid` and `paidCount` views provide verifiable evidence.

### `balanceOf` naming collision

The public `balanceOf` mapping shadows the ERC-20 convention name. This contract is not an ERC-20 token; `balanceOf` here means withdrawable native USDC balance. Callers and indexers should not treat this contract as an ERC-20.

---

## Test Suite Summary

| File | Tests | Coverage |
|---|---|---|
| `TurnPot.HappyPath.t.sol` | 11 | Full 4-round lifecycle, exact payouts, zero final balance |
| `TurnPot.Revert.t.sol` | 19 | All revert paths: wrong amount, non-member, double pay, expired, not all paid, not active, etc. |
| `TurnPot.Cancel.t.sol` | 5 | Partial payment + deadline: refunds, defaults, Cancelled status |
| `TurnPot.CreatePot.t.sol` | 13 | All validation errors, boundary values |
| `TurnPot.Reentrancy.t.sol` | 3 | Malicious receiver reentrant withdraw attempt |
| `TurnPot.Fuzz.t.sol` | 3 (×256 runs each) | Conservation of value, deadline boundary, wrong-amount fuzz |
| `TurnPot.SecurityFixes.t.sol` | 11 | CreatorNotMember fix (5 tests), withdrawTo fix (6 tests) |

**Total: 65 tests, all passing.**

---

## Disclaimer

This review was conducted with automated analysis and a rule-corpus review. It is not a substitute for a professional third-party audit before deployment with real funds.
