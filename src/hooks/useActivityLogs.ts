/**
 * useActivityLogs — fetches all TurnPot contract events, chunked in 10 000-block
 * windows, cached in memory per chainId, refreshed on demand.
 *
 * Events captured:
 *   Contributed(potId, round, member)
 *   RoundClosed(potId, round, recipient, amount)
 *   RoundCancelled(potId, round)
 *   Withdrawn(account, amount)
 *   WithdrawnTo(account, recipient, amount)
 *
 * Consumers:
 *   useWalletActivity(address) — rows for the wallet drawer
 *   useProtocolStats()         — aggregate counts / total USDC for Home
 */

import { useEffect, useState, useCallback } from 'react'
import { createPublicClient, http, parseAbiItem, decodeEventLog } from 'viem'
import { useAccount } from 'wagmi'
import { CHAIN_CONFIGS, arcMainnet, arcTestnet } from '@/lib/chain'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'

// ── Deploy blocks (start of range to scan) ────────────────────────────────────
const DEPLOY_BLOCK: Record<number, bigint> = {
  [arcMainnet.id]: 27_849_693n,
  [arcTestnet.id]: 0n,           // testnet — scan from genesis
}
const CHUNK_SIZE = 10_000n

// ── Event topic selectors ─────────────────────────────────────────────────────
const EV_CONTRIBUTED  = parseAbiItem('event Contributed(uint256 indexed potId, uint256 indexed round, address indexed member)')
const EV_CLOSED       = parseAbiItem('event RoundClosed(uint256 indexed potId, uint256 round, address indexed recipient, uint256 amount)')
const EV_CANCELLED    = parseAbiItem('event RoundCancelled(uint256 indexed potId, uint256 round)')
const EV_WITHDRAWN    = parseAbiItem('event Withdrawn(address indexed account, uint256 amount)')
const EV_WITHDRAWN_TO = parseAbiItem('event WithdrawnTo(address indexed account, address indexed recipient, uint256 amount)')

// ── Normalised log rows ───────────────────────────────────────────────────────
export type ActivityType =
  | 'Contributed'
  | 'ReceivedPot'
  | 'RefundCredited'
  | 'Withdrawn'

export interface ActivityRow {
  type: ActivityType
  potId: bigint | null       // null for Withdrawn (contract-level)
  amount: bigint             // 18-dec native USDC
  blockNumber: bigint
  txHash: `0x${string}`
  timestamp: number          // unix seconds; 0 when not yet resolved
  /** address this event is "about" — used for wallet filtering */
  actor: string
}

// ── Raw decoded types ─────────────────────────────────────────────────────────
interface RawLog {
  type: 'Contributed' | 'RoundClosed' | 'RoundCancelled' | 'Withdrawn' | 'WithdrawnTo'
  blockNumber: bigint
  txHash: `0x${string}`
  potId?: bigint
  round?: bigint
  member?: string
  recipient?: string
  amount?: bigint
  account?: string
}

// ── Cache ─────────────────────────────────────────────────────────────────────
interface CacheEntry {
  rows: RawLog[]
  scannedTo: bigint          // latest block we've fetched up to
  loading: boolean
  listeners: Set<() => void>
}

const CACHE = new Map<number, CacheEntry>()

function getOrCreate(chainId: number): CacheEntry {
  if (!CACHE.has(chainId)) {
    CACHE.set(chainId, {
      rows: [],
      scannedTo: DEPLOY_BLOCK[chainId] ?? 0n,
      loading: false,
      listeners: new Set(),
    })
  }
  return CACHE.get(chainId)!
}

// ── Core fetch function ───────────────────────────────────────────────────────
async function fetchLogs(chainId: number, turnpotAddress: `0x${string}`) {
  const entry = getOrCreate(chainId)
  if (entry.loading) return
  entry.loading = true
  entry.listeners.forEach((fn) => fn())   // notify "loading started"

  const cfg = CHAIN_CONFIGS[chainId]
  if (!cfg) { entry.loading = false; return }

  const client = createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
  })

  try {
    const latest = await client.getBlockNumber()
    const from = entry.scannedTo > 0n ? entry.scannedTo + 1n : entry.scannedTo

    // Build chunks
    const chunks: Array<{ from: bigint; to: bigint }> = []
    let cur = from
    while (cur <= latest) {
      const end = cur + CHUNK_SIZE - 1n < latest ? cur + CHUNK_SIZE - 1n : latest
      chunks.push({ from: cur, to: end })
      cur = end + 1n
    }

    for (const { from: f, to } of chunks) {
      const [contributed, closed, cancelled, withdrawn, withdrawnTo] =
        await Promise.all([
          client.getLogs({ address: turnpotAddress, event: EV_CONTRIBUTED,  fromBlock: f, toBlock: to }),
          client.getLogs({ address: turnpotAddress, event: EV_CLOSED,       fromBlock: f, toBlock: to }),
          client.getLogs({ address: turnpotAddress, event: EV_CANCELLED,    fromBlock: f, toBlock: to }),
          client.getLogs({ address: turnpotAddress, event: EV_WITHDRAWN,    fromBlock: f, toBlock: to }),
          client.getLogs({ address: turnpotAddress, event: EV_WITHDRAWN_TO, fromBlock: f, toBlock: to }),
        ])

      const newRows: RawLog[] = []

      for (const log of contributed) {
        try {
          const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'Contributed', topics: log.topics, data: log.data })
          newRows.push({ type: 'Contributed', blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', potId: d.args.potId, round: d.args.round, member: d.args.member?.toLowerCase() })
        } catch { /* skip */ }
      }

      for (const log of closed) {
        try {
          const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'RoundClosed', topics: log.topics, data: log.data })
          newRows.push({ type: 'RoundClosed', blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', potId: d.args.potId, round: d.args.round, recipient: d.args.recipient?.toLowerCase(), amount: d.args.amount })
        } catch { /* skip */ }
      }

      for (const log of cancelled) {
        try {
          const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'RoundCancelled', topics: log.topics, data: log.data })
          newRows.push({ type: 'RoundCancelled', blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', potId: d.args.potId, round: d.args.round })
        } catch { /* skip */ }
      }

      for (const log of withdrawn) {
        try {
          const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'Withdrawn', topics: log.topics, data: log.data })
          newRows.push({ type: 'Withdrawn', blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', account: d.args.account?.toLowerCase(), amount: d.args.amount })
        } catch { /* skip */ }
      }

      for (const log of withdrawnTo) {
        try {
          const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'WithdrawnTo', topics: log.topics, data: log.data })
          newRows.push({ type: 'WithdrawnTo', blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', account: d.args.account?.toLowerCase(), amount: d.args.amount })
        } catch { /* skip */ }
      }

      entry.rows.push(...newRows)
    }

    entry.scannedTo = latest
  } catch {
    // Network error — leave partial state, allow retry
  } finally {
    entry.loading = false
    entry.listeners.forEach((fn) => fn())
  }
}

// ── Determine which pots a wallet paid in (for RoundCancelled filtering) ──────
function getPotsPaidIn(rows: RawLog[], walletLower: string): Set<bigint> {
  const s = new Set<bigint>()
  for (const r of rows) {
    if (r.type === 'Contributed' && r.member === walletLower && r.potId !== undefined) {
      s.add(r.potId)
    }
  }
  return s
}

// ── Map raw logs → ActivityRow for a given wallet ─────────────────────────────
function toActivityRows(rows: RawLog[], walletLower: string, contribution: (potId: bigint) => bigint): ActivityRow[] {
  const potsPaidIn = getPotsPaidIn(rows, walletLower)
  const result: ActivityRow[] = []

  for (const r of rows) {
    if (r.type === 'Contributed' && r.member === walletLower) {
      result.push({ type: 'Contributed', potId: r.potId ?? null, amount: r.amount ?? 0n, blockNumber: r.blockNumber, txHash: r.txHash, timestamp: 0, actor: walletLower })
    } else if (r.type === 'RoundClosed' && r.recipient === walletLower) {
      result.push({ type: 'ReceivedPot', potId: r.potId ?? null, amount: r.amount ?? 0n, blockNumber: r.blockNumber, txHash: r.txHash, timestamp: 0, actor: walletLower })
    } else if (r.type === 'RoundCancelled' && r.potId !== undefined && potsPaidIn.has(r.potId)) {
      // Refund amount = contribution for that pot (we pass in a getter)
      const refund = contribution(r.potId)
      result.push({ type: 'RefundCredited', potId: r.potId, amount: refund, blockNumber: r.blockNumber, txHash: r.txHash, timestamp: 0, actor: walletLower })
    } else if ((r.type === 'Withdrawn' || r.type === 'WithdrawnTo') && r.account === walletLower) {
      result.push({ type: 'Withdrawn', potId: null, amount: r.amount ?? 0n, blockNumber: r.blockNumber, txHash: r.txHash, timestamp: 0, actor: walletLower })
    }
  }

  result.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0))
  return result
}

// ── Protocol stats from all raw rows ─────────────────────────────────────────
export interface ProtocolStats {
  potCount: number        // max potId seen + 1 (proxy; accurate once all pots are scanned)
  txCount: number         // total unique txHashes
  totalUsdc: bigint       // sum of all Contributed amounts
  loading: boolean
}

function calcStats(rows: RawLog[], loading: boolean): ProtocolStats {
  let maxPotId = -1n
  const txHashes = new Set<string>()
  let total = 0n

  for (const r of rows) {
    if (r.potId !== undefined && r.potId > maxPotId) maxPotId = r.potId
    if (r.txHash && r.txHash !== '0x') txHashes.add(r.txHash)
    if (r.type === 'Contributed' && r.amount !== undefined) total += r.amount
  }

  return {
    potCount: maxPotId >= 0n ? Number(maxPotId) + 1 : 0,
    txCount: txHashes.size,
    totalUsdc: total,
    loading,
  }
}

// ── Shared trigger ref for manual refresh ─────────────────────────────────────
type RefreshFn = () => void
const _refreshListeners = new Set<RefreshFn>()

/** Call this after any confirmed TurnPot transaction to re-scan logs. */
export function refreshActivityLogs() {
  _refreshListeners.forEach((fn) => fn())
}

// ── Hook: subscribe to cache updates for a given chain ───────────────────────
function useCacheSubscribe(chainId: number | undefined, turnpotAddress: string) {
  const [, forceUpdate] = useState(0)

  const doFetch = useCallback(() => {
    if (!chainId || !turnpotAddress) return
    void fetchLogs(chainId, turnpotAddress as `0x${string}`)
  }, [chainId, turnpotAddress])

  useEffect(() => {
    if (!chainId || !turnpotAddress) return
    const entry = getOrCreate(chainId)
    const update = () => forceUpdate((n) => n + 1)
    entry.listeners.add(update)
    // Register as a refresh listener
    _refreshListeners.add(doFetch)
    // Initial fetch if cache is cold
    if (entry.scannedTo === (DEPLOY_BLOCK[chainId] ?? 0n) && entry.rows.length === 0 && !entry.loading) {
      void fetchLogs(chainId, turnpotAddress as `0x${string}`)
    }
    return () => {
      entry.listeners.delete(update)
      _refreshListeners.delete(doFetch)
    }
  }, [chainId, turnpotAddress, doFetch])

  const refresh = useCallback(() => {
    if (!chainId || !turnpotAddress) return
    // Reset scanned range to re-check tip blocks only (keep existing rows)
    // Actually we want to append new blocks — just re-trigger
    void fetchLogs(chainId, turnpotAddress as `0x${string}`)
  }, [chainId, turnpotAddress])

  const entry = chainId ? CACHE.get(chainId) : undefined
  return { rows: entry?.rows ?? [], loading: entry?.loading ?? false, refresh }
}

// ── Public hook: wallet activity ─────────────────────────────────────────────
export function useWalletActivity(address: `0x${string}` | undefined) {
  const { chainId } = useAccount()
  const cfg = chainId !== undefined ? CHAIN_CONFIGS[chainId] : undefined
  const turnpotAddress = cfg?.turnpotAddress ?? ''

  const { rows, loading, refresh } = useCacheSubscribe(
    cfg ? chainId : undefined,
    turnpotAddress,
  )

  const walletLower = address?.toLowerCase() ?? ''

  // We don't have contribution amounts per pot here — use 0n for refunds (amount
  // not tracked in the event; show as "refund" without amount)
  const activity = walletLower
    ? toActivityRows(rows, walletLower, () => 0n)
    : []

  return { activity, loading, refresh }
}

// ── Public hook: protocol stats ───────────────────────────────────────────────
export function useProtocolStats() {
  const { chainId } = useAccount()

  // Also works when disconnected — fall back to mainnet config
  const effectiveChainId = chainId !== undefined ? chainId : arcMainnet.id
  const cfg = CHAIN_CONFIGS[effectiveChainId]
  const turnpotAddress = cfg?.turnpotAddress ?? ''

  const { rows, loading, refresh } = useCacheSubscribe(
    turnpotAddress ? effectiveChainId : undefined,
    turnpotAddress,
  )

  return { stats: calcStats(rows, loading), refresh }
}
