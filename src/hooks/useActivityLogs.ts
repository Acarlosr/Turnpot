/**
 * useActivityLogs — fetches all TurnPot contract events, chunked in 5 000-block
 * windows, cached in memory per chainId, refreshed on demand.
 *
 * Ad-blocker resilience: tries each RPC in the fallback list in turn; marks the
 * cache entry as `failed` only when every RPC is unreachable.
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
 *   (Protocol stats now live in useProtocolStats — view-call based, not getLogs)
 */

import { useEffect, useState, useCallback } from 'react'
import { createPublicClient, http, parseAbiItem, decodeEventLog } from 'viem'
import { useAccount } from 'wagmi'
import { CHAIN_CONFIGS, arcMainnet, arcTestnet } from '@/lib/chain'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'

// ── Deploy blocks (start of range to scan) ────────────────────────────────────
const DEPLOY_BLOCK: Record<number, bigint> = {
  [arcMainnet.id]: 27_849_693n,
  [arcTestnet.id]: 0n,
}
const CHUNK_SIZE = 2_000n
const MAX_RPC_RETRIES = 3

// ── Fallback RPC lists per chain ─────────────────────────────────────────────
const FALLBACK_RPCS: Record<number, string[]> = {
  [arcMainnet.id]: [
    'https://rpc.mainnet.arc.io',
    'https://rpc.drpc.mainnet.arc.io',
    'https://rpc.quicknode.mainnet.arc.io',
    'https://rpc.blockdaemon.mainnet.arc.io',
  ],
  [arcTestnet.id]: [
    'https://rpc.testnet.arc.io',
  ],
}

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
  potId: bigint | null
  amount: bigint
  blockNumber: bigint
  txHash: `0x${string}`
  timestamp: number
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
  scannedTo: bigint
  loading: boolean
  failed: boolean
  listeners: Set<() => void>
}

const CACHE = new Map<number, CacheEntry>()

function getOrCreate(chainId: number): CacheEntry {
  if (!CACHE.has(chainId)) {
    CACHE.set(chainId, {
      rows: [],
      scannedTo: DEPLOY_BLOCK[chainId] ?? 0n,
      loading: false,
      failed: false,
      listeners: new Set(),
    })
  }
  return CACHE.get(chainId)!
}

// ── Exponential backoff helper ────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Retry fn up to MAX_RPC_RETRIES times with exponential backoff on 429/400. */
async function fetchWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let delay = 1_000
  let lastErr: unknown
  for (let i = 0; i < MAX_RPC_RETRIES; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const isRateLimit = msg.includes('429') || msg.includes('400') || msg.includes('rate') || msg.includes('limit')
      if (i < MAX_RPC_RETRIES - 1) {
        await sleep(isRateLimit ? delay : 300)
        if (isRateLimit) delay *= 2
      }
    }
  }
  throw lastErr
}

// ── Core fetch function (tries each RPC in turn) ──────────────────────────────
async function fetchLogs(chainId: number, turnpotAddress: `0x${string}`) {
  const entry = getOrCreate(chainId)
  if (entry.loading) return
  entry.loading = true
  entry.failed = false
  entry.listeners.forEach((fn) => fn())

  const cfg = CHAIN_CONFIGS[chainId]
  if (!cfg) { entry.loading = false; return }

  const rpcs = FALLBACK_RPCS[chainId] ?? [cfg.rpcUrl]

  let lastError: unknown
  for (const rpcUrl of rpcs) {
    const client = createPublicClient({
      chain: cfg.chain,
      transport: http(rpcUrl, { retryCount: 1, timeout: 8_000 }),
    })

    try {
      const latest = await client.getBlockNumber()
      const from = entry.scannedTo > 0n ? entry.scannedTo + 1n : entry.scannedTo

      const chunks: Array<{ from: bigint; to: bigint }> = []
      let cur = from
      while (cur <= latest) {
        const end = cur + CHUNK_SIZE - 1n < latest ? cur + CHUNK_SIZE - 1n : latest
        chunks.push({ from: cur, to: end })
        cur = end + 1n
      }

      for (const { from: f, to } of chunks) {
        // Sequential calls (not parallel) to avoid overwhelming the RPC with
        // 5 concurrent getLogs requests per chunk.
        const contributed = await fetchWithBackoff(() =>
          client.getLogs({ address: turnpotAddress, event: EV_CONTRIBUTED,  fromBlock: f, toBlock: to }))
        const closed = await fetchWithBackoff(() =>
          client.getLogs({ address: turnpotAddress, event: EV_CLOSED,       fromBlock: f, toBlock: to }))
        const cancelled = await fetchWithBackoff(() =>
          client.getLogs({ address: turnpotAddress, event: EV_CANCELLED,    fromBlock: f, toBlock: to }))
        const withdrawn = await fetchWithBackoff(() =>
          client.getLogs({ address: turnpotAddress, event: EV_WITHDRAWN,    fromBlock: f, toBlock: to }))
        const withdrawnTo = await fetchWithBackoff(() =>
          client.getLogs({ address: turnpotAddress, event: EV_WITHDRAWN_TO, fromBlock: f, toBlock: to }))

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
      // Success — don't try remaining RPCs
      lastError = undefined
      break
    } catch (err) {
      lastError = err
      // Try next RPC
    }
  }

  if (lastError !== undefined) {
    entry.failed = true
  }

  entry.loading = false
  entry.listeners.forEach((fn) => fn())
}

// ── Determine which pots a wallet paid in ─────────────────────────────────────
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
      const refund = contribution(r.potId)
      result.push({ type: 'RefundCredited', potId: r.potId, amount: refund, blockNumber: r.blockNumber, txHash: r.txHash, timestamp: 0, actor: walletLower })
    } else if ((r.type === 'Withdrawn' || r.type === 'WithdrawnTo') && r.account === walletLower) {
      result.push({ type: 'Withdrawn', potId: null, amount: r.amount ?? 0n, blockNumber: r.blockNumber, txHash: r.txHash, timestamp: 0, actor: walletLower })
    }
  }

  result.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0))
  return result
}

// ── Shared trigger ref for manual refresh ─────────────────────────────────────
type RefreshFn = () => void
const _refreshListeners = new Set<RefreshFn>()

export function refreshActivityLogs() {
  _refreshListeners.forEach((fn) => fn())
}

// ── Hook: subscribe to cache updates for a given chain ────────────────────────
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
    _refreshListeners.add(doFetch)
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
    void fetchLogs(chainId, turnpotAddress as `0x${string}`)
  }, [chainId, turnpotAddress])

  const entry = chainId ? CACHE.get(chainId) : undefined
  return { rows: entry?.rows ?? [], loading: entry?.loading ?? false, failed: entry?.failed ?? false, refresh }
}

// ── Public hook: wallet activity ─────────────────────────────────────────────
export function useWalletActivity(address: `0x${string}` | undefined) {
  const { chainId } = useAccount()
  const cfg = chainId !== undefined ? CHAIN_CONFIGS[chainId] : undefined
  const turnpotAddress = cfg?.turnpotAddress ?? ''

  const { rows, loading, failed, refresh } = useCacheSubscribe(
    cfg ? chainId : undefined,
    turnpotAddress,
  )

  const walletLower = address?.toLowerCase() ?? ''
  const activity = walletLower
    ? toActivityRows(rows, walletLower, () => 0n)
    : []

  return { activity, loading, failed, refresh }
}
