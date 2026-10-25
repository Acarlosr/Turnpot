# TurnPot — Rotating Savings Circle (ROSCA)

A decentralised rotating savings circle where every member contributes each round and one member takes the full pot, repeating until everyone has received it once.

Built with [Arc Studio](https://studio.arc.io)

---

## What it does

Members form a pot of 2–10 participants. In each round every member contributes an equal amount in native USDC. At the end of the round the whole pool is credited to the next recipient in the agreed order. If someone misses the deadline the round is cancelled, payers are refunded, and the defaulter's count increments. Winnings and refunds accumulate as a withdrawable balance; members pull funds at any time.

Known as *consórcio* in Brazil, *tanda* in Mexico, *susu* in West Africa.

---

## Tech stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion
- **Web3**: wagmi v2, viem v2, ConnectKit
- **Contract**: Solidity 0.8.28 + Foundry, deployed on Arc Testnet
- **Chain**: Arc Testnet (chain ID 5042002) — configurable to Arc mainnet via `VITE_CHAIN=mainnet`

---

## Development

### Prerequisites

- Bun ≥ 1.0
- Foundry (for contract work)

### Install

```bash
bun install
```

### Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `VITE_CHAIN` | `testnet` (default) or `mainnet` | No |
| `VITE_TURNPOT_ADDRESS_TESTNET` | Override testnet contract address | No |
| `VITE_TURNPOT_ADDRESS_MAINNET` | Arc mainnet contract address | Only for mainnet |

### Run

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Build contracts

```bash
bun run contracts:build
```

### Test contracts

```bash
bun run contracts:test
```

The test suite has 65 tests across 8 files covering the full lifecycle, all revert paths, reentrancy resistance, fuzz conservation of value, and tests for both security fixes. See `SECURITY.md` for the full security review.

---

## Contract interface

**Deployed**: `0x2cdf78c00436087866429c9c09dbd89e6cf3717b` on Arc Testnet

| Function | Description |
|---|---|
| `createPot(members, contribution, roundDuration)` | Create a pot; caller must be a member |
| `contribute(potId)` payable | Pay the exact contribution before the deadline |
| `closeRound(potId)` | Close the round once all members have paid |
| `cancelRound(potId)` | Cancel after the deadline if not all paid |
| `withdraw()` | Pull your full withdrawable balance |
| `withdrawTo(recipient)` | Pull to a different address (for contract wallets) |

---

## Pointing at Arc mainnet

1. Deploy the contract on Arc mainnet from your own wallet.
2. Set `VITE_CHAIN=mainnet` and `VITE_TURNPOT_ADDRESS_MAINNET=0x<your address>` in `.env`.
3. `bun run dev` (or `bun run build`).
