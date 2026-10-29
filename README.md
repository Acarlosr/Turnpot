# TurnPot — Rotating Savings Circle (ROSCA)

A decentralised rotating savings circle where every member contributes each round and one member takes the full pot, repeating until everyone has received it once.

Built with [Arc Studio](https://studio.arc.io)

**Live app:** https://turnpot.vercel.app
**Mainnet contract:** https://explorer.arc.io/address/0xc2e7c67334cb6fce6f2e3809000d804481d12bf3
**Deploy tx:** https://explorer.arc.io/tx/0x28f07c32da1c891b868fe385b9fdf3452a2cf61f2c419fa457eefde19498bc1e
**Verified source (Sourcify — exact match):** https://sourcify.dev/repository/contracts/full_match/5042/0xC2e7C67334cb6fCe6f2E3809000D804481d12bF3/
**Arc Studio project:** https://studio.arc.io/app/9b0de8d7-a57f-4024-b081-b8fdcf60ac70

---

## What it does

Members form a pot of 2–10 participants. In each round every member contributes an equal amount in native USDC. At the end of the round the whole pool is credited to the next recipient in the agreed order. If someone misses the deadline the round is cancelled, payers are refunded, and the defaulter's count increments. Winnings and refunds accumulate as a withdrawable balance; members pull funds at any time.

Known as *consórcio* in Brazil, *tanda* in Mexico, *susu* in West Africa.

---

## Tech stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion
- **Web3**: wagmi v2, viem v2, ConnectKit
- **Contract**: Solidity 0.8.28 + Foundry, deployed on Arc Testnet
- **Chain**: Arc Testnet (5042002) and Arc Mainnet (5042) — network-aware at runtime; the wallet's connected chain determines which contract and explorer are used
- **Theming**: light/dark mode with system-preference default, persisted to `localStorage`
- **i18n**: English, Português (Brasil), Español — browser-detected with `localStorage` persistence, switchable via the flag picker in the header
- **Routing**: client-side URL routing (`/`, `/create`, `/pot/:id`, `/deploy`) with `vercel.json` SPA rewrite for deep-link refreshes

---

## Development

### Prerequisites

- Bun ≥ 1.0
- Foundry (for contract work)

### Install

```bash
bun install
```

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

**Arc Mainnet**: [`0xc2e7c67334cb6fce6f2e3809000d804481d12bf3`](https://explorer.arc.io/address/0xc2e7c67334cb6fce6f2e3809000d804481d12bf3)
**Arc Testnet**: `0x9a12d53666af8359a042a89c433701e97296530f`

| Function | Description |
|---|---|
| `createPot(members, contribution, roundDuration)` | Create a pot; caller must be a member |
| `contribute(potId)` payable | Pay the exact contribution before the deadline |
| `closeRound(potId)` | Close the round once all members have paid |
| `cancelRound(potId)` | Cancel after the deadline if not all paid |
| `withdraw()` | Pull your full withdrawable balance |
| `withdrawTo(recipient)` | Pull to a different address (for contract wallets) |

---

## Environment variables

All variables are optional — the mainnet and testnet addresses are hardcoded in `src/lib/chain.ts`.

| Variable | Purpose |
|---|---|
| `VITE_CHAIN` | `testnet` (default) or `mainnet` — sets the default chain at build time |
| `VITE_TURNPOT_ADDRESS_TESTNET` | Override the testnet contract address |
| `VITE_TURNPOT_ADDRESS_MAINNET` | Override the mainnet contract address |
| `VITE_RPC_MAINNET` | Primary RPC for Arc Mainnet (default: `https://rpc.mainnet.arc.io`) |
| `VITE_RPC_TESTNET` | Primary RPC for Arc Testnet (default: `https://rpc.testnet.arc.io`) |

### Deploying to Vercel (production)

Set these two environment variables in your Vercel project settings before deploying:

```
VITE_RPC_MAINNET=https://your-private-rpc.example.com/arc-mainnet
VITE_CHAIN=mainnet
```

`VITE_RPC_MAINNET` routes all read calls through your private or rate-limit-free RPC endpoint instead of the public `rpc.mainnet.arc.io`. `VITE_CHAIN=mainnet` makes the app default to Arc Mainnet for disconnected users. Both variables take effect at build time — redeploy after changing them.
