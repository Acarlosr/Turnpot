/**
 * Chain and contract configuration for TurnPot.
 *
 * Supported chains: Arc Testnet (5042002) and Arc Mainnet (5042).
 * The app is network-aware at runtime — it reads the wallet's connected chain
 * and looks up the right contract address and explorer from CHAIN_CONFIGS.
 *
 * To fill in the mainnet address after deploy, update CONTRACT_ADDRESS_MAINNET.
 */
import type { Chain } from 'viem'
import { useAccount } from 'wagmi'

// ─── RPC overrides from environment ──────────────────────────────────────────
// Set VITE_RPC_MAINNET / VITE_RPC_TESTNET in .env to use a private or custom RPC.
// Falls back to the public Arc endpoints when not set.

const RPC_MAINNET: string =
  (import.meta.env.VITE_RPC_MAINNET as string | undefined) ?? 'https://rpc.mainnet.arc.io'

const RPC_TESTNET: string =
  (import.meta.env.VITE_RPC_TESTNET as string | undefined) ?? 'https://rpc.testnet.arc.io'

// ─── Chain definitions ────────────────────────────────────────────────────────

export const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_TESTNET] },
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
    default: { http: [RPC_MAINNET] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
} as const satisfies Chain

// ─── Contract addresses ───────────────────────────────────────────────────────
// Both addresses are committed here so any deployed build works without env vars.
// .env overrides (VITE_TURNPOT_ADDRESS_TESTNET / VITE_TURNPOT_ADDRESS_MAINNET)
// are optional and only needed when pointing at a different deployment.

const CONTRACT_ADDRESS_TESTNET: string =
  (import.meta.env.VITE_TURNPOT_ADDRESS_TESTNET as string | undefined) ??
  '0x9a12d53666af8359a042a89c433701e97296530f'

const CONTRACT_ADDRESS_MAINNET: string =
  (import.meta.env.VITE_TURNPOT_ADDRESS_MAINNET as string | undefined) ??
  '0xc2e7c67334cb6fce6f2e3809000d804481d12bf3'

// ─── Per-chain config map ─────────────────────────────────────────────────────

export interface ChainConfig {
  chain: Chain
  chainId: number
  chainName: string
  isTestnet: boolean
  turnpotAddress: string      // empty string = not deployed yet
  explorerBase: string
  rpcUrl: string
}

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  [arcTestnet.id]: {
    chain: arcTestnet,
    chainId: arcTestnet.id,
    chainName: arcTestnet.name,
    isTestnet: true,
    turnpotAddress: CONTRACT_ADDRESS_TESTNET,
    explorerBase: 'https://explorer.testnet.arc.io',
    rpcUrl: RPC_TESTNET,
  },
  [arcMainnet.id]: {
    chain: arcMainnet,
    chainId: arcMainnet.id,
    chainName: 'Arc Mainnet',
    isTestnet: false,
    turnpotAddress: CONTRACT_ADDRESS_MAINNET,
    explorerBase: 'https://explorer.arc.io',
    rpcUrl: RPC_MAINNET,
  },
}

export const SUPPORTED_CHAIN_IDS = Object.keys(CHAIN_CONFIGS).map(Number)

// ─── Hook: resolve config for the wallet's connected chain ───────────────────

export interface ActiveChainConfig extends ChainConfig {
  isKnown: boolean           // true when the chain is one of our two Arc chains
  isDeployed: boolean        // true when turnpotAddress is non-empty
  turnpotAddress: `0x${string}` | ''
}

export function useActiveChainConfig(): ActiveChainConfig {
  const { chainId } = useAccount()
  const cfg = chainId !== undefined ? CHAIN_CONFIGS[chainId] : undefined

  if (cfg) {
    return {
      ...cfg,
      turnpotAddress: cfg.turnpotAddress as `0x${string}` | '',
      isKnown: true,
      isDeployed: cfg.turnpotAddress.length > 0,
    }
  }

  // Wallet disconnected or on an unknown chain — fall back to mainnet config
  return {
    ...CHAIN_CONFIGS[arcMainnet.id],
    turnpotAddress: CONTRACT_ADDRESS_MAINNET as `0x${string}`,
    isKnown: chainId === undefined,   // undefined = disconnected (not "wrong chain")
    isDeployed: CONTRACT_ADDRESS_MAINNET.length > 0,
  }
}

// ─── Explorer helpers (use active chain config or pass chainId explicitly) ───

export function explorerTx(hash: string, chainId?: number): string {
  const base = (chainId !== undefined ? CHAIN_CONFIGS[chainId]?.explorerBase : undefined)
    ?? CHAIN_CONFIGS[arcMainnet.id].explorerBase
  return `${base}/tx/${hash}`
}

export function explorerAddr(address: string, chainId?: number): string {
  const base = (chainId !== undefined ? CHAIN_CONFIGS[chainId]?.explorerBase : undefined)
    ?? CHAIN_CONFIGS[arcMainnet.id].explorerBase
  return `${base}/address/${address}`
}

// ─── Legacy constants kept for backward compat (DeployPage, WalletPanel) ────

export const TARGET_CHAIN = arcTestnet as Chain
export const TARGET_CHAIN_ID = arcTestnet.id
export const TURNPOT_ADDRESS = CONTRACT_ADDRESS_TESTNET as `0x${string}`
