# How TurnPot Was Built in Arc Studio

**Arc Studio project URL:** https://studio.arc.io/app/9b0de8d7-a57f-4024-b081-b8fdcf60ac70

**Date:** 2026-10-25

---

## Session turns

| # | Prompt summary | Produced | Fixed / iterated |
|---|---|---|---|
| 1 | Contract spec: ROSCA with native USDC on Arc, exact function names, events, custom errors, pull-payment, no admin | `contracts/TurnPot.sol` — full ROSCA implementation in Solidity 0.8.x with OpenZeppelin ReentrancyGuard | Nothing — both security reviewers returned no findings on first pass |
| 2 | Foundry test suite: happy path, all revert cases, cancelRound lifecycle, createPot validation, reentrancy attack, fuzz test for value conservation | 7 test files in `contracts/test/` — 54 tests, all passing on first run | Nothing — no contract bugs found |
| 3 | Security review (max severity): reentrancy, rounding, stuck funds, griefing, DoS, timestamp assumptions, non-payable member address | `SECURITY.md`; two fixes applied to `TurnPot.sol`: (1) `CreatorNotMember` — `createPot` now requires caller to be a listed member; (2) `withdrawTo(address payable)` — lets non-payable member contracts rescue their balance to an EOA | Existing tests updated with `vm.prank` to satisfy the new `CreatorNotMember` guard; 11 new tests added in `TurnPot.SecurityFixes.t.sol`; total suite grew to 65 tests, all passing |
| 4 | Web app: Home, Create Pot, Pot Page, Wallet Panel, history, chain config for testnet + mainnet | Full React + wagmi + ConnectKit app in `src/` — pages, hooks, components, ABI, chain config, format helpers | Multiple lint/typecheck rounds to resolve React Compiler purity rules (`Date.now` at render, unhandled promises, conditional hooks); all resolved without logic changes |
| 5 | Deploy to Arc Testnet + end-to-end integration test (2 scenarios via fork) | Redeployed security-fixed contract to Arc Testnet; integration test script at `fork-tests/TurnPot.integration.test.ts`; 28 assertions, all passing | Nothing — clean on first run |
| 6 | Fix duplicate "Connect Wallet" button and double "TurnPot" title in preview | Removed second `<ConnectKitButton>` and duplicate title from `Home.tsx` hero card; moved logo + USDC icon to single `<header>` in `App.tsx`; tightened container to `max-w-lg px-4 sm:px-6` | Nothing — lint/typecheck clean on first attempt |

---

## Foundry test suite

| File | Tests | Status |
|---|---|---|
| `contracts/test/TurnPot.HappyPath.t.sol` | 11 | Passing |
| `contracts/test/TurnPot.Revert.t.sol` | 19 | Passing |
| `contracts/test/TurnPot.Cancel.t.sol` | 5 | Passing |
| `contracts/test/TurnPot.CreatePot.t.sol` | 13 | Passing |
| `contracts/test/TurnPot.Reentrancy.t.sol` | 3 | Passing |
| `contracts/test/TurnPot.Fuzz.t.sol` | 3 (256 runs each) | Passing |
| `contracts/test/TurnPot.SecurityFixes.t.sol` | 11 | Passing |
| **Total** | **65** | **All passing** |

Run with: `bun run contracts:test`

---

## Deployed contracts

### Arc Mainnet

| Version | Address | Deploy tx |
|---|---|---|
| v2 (security-fixed) | [`0xc2e7c67334cb6fce6f2e3809000d804481d12bf3`](https://explorer.arc.io/address/0xc2e7c67334cb6fce6f2e3809000d804481d12bf3) | [`0x28f07c32da1c891b868fe385b9fdf3452a2cf61f2c419fa457eefde19498bc1e`](https://explorer.arc.io/tx/0x28f07c32da1c891b868fe385b9fdf3452a2cf61f2c419fa457eefde19498bc1e) |

Sanity check (read on 2026-10-25): `potCount() = 0`, `MAX_CONTRIBUTION() = 1000000000000000000` (1 USDC).

### Arc Testnet

| Version | Address | Notes |
|---|---|---|
| v1 (original) | `0x2cdf78c00436087866429c9c09dbd89e6cf3717b` | Superseded — pre-security-review |
| v2 (security-fixed) | `0x9a12d53666af8359a042a89c433701e97296530f` | **Current** — includes `CreatorNotMember` + `withdrawTo` fixes |

Explorer: https://explorer.testnet.arc.io/address/0x9a12d53666af8359a042a89c433701e97296530f

---

## End-to-end transaction hashes (Arc Testnet, contract v2)

### Scenario 1 — Full happy path (pot 0: 2 members, 2 rounds, both withdraw)

| # | Function | Sender | Tx hash |
|---|---|---|---|
| 1 | `createPot([m1,m2], 0.1 USDC, 120s)` | member1 | `0x89971a1dd75d5845a4d2601272783f37daae493b1e38f6fadfbfe380c90d8fb6` |
| 2 | `contribute(0)` — round 0 | member1 | `0x61be840018ebac2f384680658549dce8a3d8a87a63eb7d6d4397de6ea164308b` |
| 3 | `contribute(0)` — round 0 | member2 | `0x365a4559b1f0f880b7dfa8a4852044ccee369dd301b1457d55b0cd90d34a483c` |
| 4 | `closeRound(0)` — member1 receives 0.2 USDC | member1 | `0x2f9d15ee16f0a891f5448de8083d8c5dd8527009063d0fcbf12c0df209981761` |
| 5 | `contribute(0)` — round 1 | member1 | `0xe3a6cd5a3e041f33a380769328346392cf15839d8edc0a013d41af1011d83c14` |
| 6 | `contribute(0)` — round 1 | member2 | `0xd283008114bff74fb44ef04e3d22396b7bd4b2d132fb4f2ec43c73e35ef15319` |
| 7 | `closeRound(0)` — member2 receives 0.2 USDC, status → Completed | member2 | `0xa6f8626bffebae69c233bea86c7fb6c32ee321d4119f4880dccf2d3a3ddc3dd0` |
| 8 | `withdraw()` | member1 | `0x84b25da5f81f1545bfcf0e367b62f7bf98ec14dc2a4ae1b70a64edda6950e76c` |
| 9 | `withdraw()` | member2 | `0x32fd55aea446456a9bb40325ce7b76608e36aa3eec2e1f2e51c6228b196e6530` |

Final state: status Completed, both `balanceOf` = 0, contract balance = 0.

### Scenario 2 — Partial payment, cancel, refund (pot 1)

| # | Function | Sender | Tx hash |
|---|---|---|---|
| 10 | `createPot([m1,m2], 0.05 USDC, 120s)` | member1 | `0x38d42df0d5694583ed72bd1890b3418c148f1dcfd61345785166a139453753b8` |
| 11 | `contribute(1)` — member1 only | member1 | `0xfa79eefaa6ee7e92e026ffaf496424e5523bc008aed92f2ee64ef8adba1805bb` |
| 12 | `cancelRound(1)` — after deadline +130s | member1 | `0x46f968b9ef18718b92bd4e84e0e6ee4f6b9445b0d64b3eccbea0f1c0a0c2a4d4` |
| 13 | `withdraw()` — member1 refund 0.05 USDC | member1 | `0x7cd798cd1058fe23b83b57e59d608c5714066e027e16262294099474532684b8` |

Final state: status Cancelled, `defaults[member2]` = 1, contract balance = 0.

---

## Security findings summary

Two real findings were identified and fixed before the production deploy:

| Severity | Finding | Fix |
|---|---|---|
| High | **Unconsented membership default griefing** — anyone could call `createPot` listing arbitrary victim addresses, wait for the deadline, then call `cancelRound` to inflate `defaults[victim]` at zero cost | `createPot` now reverts `CreatorNotMember` if the caller is not in the members array |
| Medium | **Non-payable member address — permanently stuck funds** — a member that is a contract without `receive()` could never call `withdraw()`, locking their balance forever | Added `withdrawTo(address payable recipient)` with the same `nonReentrant` + CEI protections |

See `SECURITY.md` for the full report including reviewed-and-cleared areas (reentrancy, rounding, stuck funds, DoS, timestamp assumptions) and the known limitation below.

**Known limitation (documented, not fixable without model change):** a member who receives their payout in round N can stop paying in rounds N+1 onward. `defaults[member]` increments and remaining members receive refunds via `cancelRound`, but the already-disbursed payout cannot be recovered. This is inherent to the ROSCA model's social-trust foundation.

---

> Arc Studio deploys to testnet only. The mainnet contract was deployed with Foundry from the owner's wallet, from exactly the same source Studio wrote and tested (same compiler settings, same bytecode the 65-test suite ran against).
