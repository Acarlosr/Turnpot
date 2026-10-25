# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

TurnPot is a rotating savings circle (ROSCA) smart contract on Arc Testnet. Members form a pot, contribute native USDC each round, and the full pool pays out to one member per round in array order — no admin, no fees, fully on-chain pull-payment.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```

## Deployed Contracts

| Contract | Network | Address | Notes |
|---|---|---|---|
| TurnPot (v2, security-fixed) | Arc Testnet | `0x9a12d53666af8359a042a89c433701e97296530f` | Current — includes CreatorNotMember + withdrawTo fixes |
| TurnPot (v1, original) | Arc Testnet | `0x2cdf78c00436087866429c9c09dbd89e6cf3717b` | Superseded — pre-security-review |

Explorer (v2): https://explorer.testnet.arc.io/address/0x9a12d53666af8359a042a89c433701e97296530f

## Design Decisions

- Native USDC (msg.value, 18 decimals) — no ERC-20 approve/transferFrom needed on Arc.
- MAX_CONTRIBUTION = 1 ether (= 1 USDC in 18-decimal native).
- Payout order fixed by members array at creation; no shuffling, no admin override.
- Pull-payment pattern: payouts and refunds accumulate in `balanceOf[member]`; members call `withdraw()`.
- `cancelRound` is permissionless — callable by anyone after the deadline if not all paid.
- `closeRound` is permissionless — callable by anyone once all members paid.
- `defaults[member]` tracks missed rounds but does not gate future participation (tracking only).
