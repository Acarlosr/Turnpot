/**
 * logs-client.ts — dedicated viem PublicClient for eth_getLogs only.
 *
 * NEVER use the VITE_RPC_MAINNET (Chainstack) endpoint for getLogs — Chainstack
 * full-node plans reject archive queries with -32002. This module always uses
 * only the public Arc RPC for getLogs. All other calls (reads, balances, receipts,
 * send) continue through wagmi's configured transport (which uses VITE_RPC_MAINNET).
 *
 * Also exports localStorage helpers for persisting decoded log rows between
 * sessions, keyed by chainId + contract address.
 */

import { createPublicClient, http } from 'viem'
import { arcMainnet, arcTestnet } from '@/lib/chain'
import type { Chain } from 'viem'

// ── Public-only RPC URLs for getLogs ─────────────────────────────────────────
// drpc returns 400 on getLogs — excluded.
// VITE_RPC_MAINNET is intentionally NOT included here.
export const LOGS_RPCS: Record<number, string[]> = {
  [arcMainnet.id]: [
    'https://rpc.mainnet.arc.io',
    'https://rpc.quicknode.mainnet.arc.io',
    'https://rpc.blockdaemon.mainnet.arc.io',
  ],
  [arcTestnet.id]: [
    'https://rpc.testnet.arc.io',
  ],
}

// ── Client factory ────────────────────────────────────────────────────────────
// One client per (chainId, rpcUrl) pair, cached in a module-level map.
const _clients = new Map<string, ReturnType<typeof createPublicClient>>()

export function getLogsClient(chainId: number, rpcUrl: string): ReturnType<typeof createPublicClient> {
  const key = `${chainId}:${rpcUrl}`
  if (!_clients.has(key)) {
    const chain: Chain = chainId === arcMainnet.id ? arcMainnet : arcTestnet
    _clients.set(key, createPublicClient({
      chain,
      transport: http(rpcUrl, { retryCount: 0, timeout: 10_000 }),
    }))
  }
  return _clients.get(key)!
}

// ── Sleep helper ──────────────────────────────────────────────────────────────
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Rate-limit backoff for a single getLogs call ──────────────────────────────
// Delays: 2s, 4s, 8s before giving up on a chunk.
const BACKOFF_MS = [2_000, 4_000, 8_000]

export async function logsWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= BACKOFF_MS.length; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < BACKOFF_MS.length) {
        const msg = err instanceof Error ? err.message : String(err)
        const waitMs = (msg.includes('429') || msg.includes('rate') || msg.includes('limit'))
          ? BACKOFF_MS[i]
          : 500          // non-rate-limit error: shorter wait before retry
        await sleep(waitMs)
      }
    }
  }
  throw lastErr
}

// ── Between-chunk pause (300 ms as required) ──────────────────────────────────
export const BETWEEN_CHUNKS_MS = 300

// ── localStorage persistence ──────────────────────────────────────────────────

export interface PersistedLogCache<T> {
  scannedTo: string   // bigint serialised as decimal string
  rows: T[]
}

function lsKey(chainId: number, address: string): string {
  return `tp:logs:${chainId}:${address.toLowerCase()}`
}

export function loadFromStorage<T>(chainId: number, address: string): PersistedLogCache<T> | null {
  try {
    const raw = localStorage.getItem(lsKey(chainId, address))
    if (!raw) return null
    return JSON.parse(raw) as PersistedLogCache<T>
  } catch {
    return null
  }
}

export function saveToStorage<T>(chainId: number, address: string, scannedTo: bigint, rows: T[]): void {
  try {
    const payload: PersistedLogCache<T> = {
      scannedTo: scannedTo.toString(),
      rows,
    }
    localStorage.setItem(lsKey(chainId, address), JSON.stringify(payload))
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

export function clearStorage(chainId: number, address: string): void {
  try {
    localStorage.removeItem(lsKey(chainId, address))
  } catch { /* ignore */ }
}
