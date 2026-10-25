/**
 * Chain and contract configuration.
 * Switch VITE_CHAIN=mainnet to point the app at Arc mainnet.
 *
 * Both chains are defined inline so endpoint values are explicit and not
 * inherited from a bundled library that may lag behind network migrations.
 */
import type { Chain } from 'viem'

export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Testnet Explorer', url: 'https://explorer.testnet.arc.io' },
  },
  testnet: true,
} as const satisfies Chain

export const arcMainnet = {
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
} as const satisfies Chain

const IS_MAINNET = import.meta.env.VITE_CHAIN === 'mainnet'

export const TARGET_CHAIN: Chain = IS_MAINNET ? arcMainnet : arcTestnet

export const TARGET_CHAIN_ID = TARGET_CHAIN.id

// Contract address per environment
const CONTRACT_ADDRESS_TESTNET =
  (import.meta.env.VITE_TURNPOT_ADDRESS_TESTNET as string | undefined) ??
  '0x9a12d53666af8359a042a89c433701e97296530f'

const CONTRACT_ADDRESS_MAINNET =
  (import.meta.env.VITE_TURNPOT_ADDRESS_MAINNET as string | undefined) ?? ''

export const TURNPOT_ADDRESS: `0x${string}` = (
  IS_MAINNET ? CONTRACT_ADDRESS_MAINNET : CONTRACT_ADDRESS_TESTNET
) as `0x${string}`

// Explorer helpers — always derived from the active chain definition, never hardcoded.
// Both arcTestnet and arcMainnet always define blockExplorers; the non-null assertion is safe.
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const EXPLORER_BASE = TARGET_CHAIN.blockExplorers!.default.url

export function explorerTx(hash: string): string {
  return `${EXPLORER_BASE}/tx/${hash}`
}

export function explorerAddr(address: string): string {
  return `${EXPLORER_BASE}/address/${address}`
}
