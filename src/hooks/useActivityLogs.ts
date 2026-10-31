/**
 * useActivityLogs — fetches TurnPot contract events for the wallet activity drawer.
 *
 * Fetch strategy:
 *   1. Try Arc explorer API (module=logs&action=getLogs, paginated 1000/page).
 *      Timestamps come directly from the API — no getBlock calls needed.
 *   2. On API failure (CORS, network, message!="OK"), fall back to direct
 *      eth_getLogs via the public Arc RPC (never the Chainstack env-var endpoint).
 *
 * Persistence:
 *   Decoded rows + last scanned block stored in localStorage keyed by
 *   chainId + contract address. Next visit only fetches from lastScannedBlock+1.
 *
 * Chain guard:
 *   Only runs queries for the wallet's active chain (5042 or 5042002).
 *   Never queries testnet when active chain is mainnet.
 */

import { useEffect, useState, useCallback } from 'react'
import { parseAbiItem, decodeEventLog } from 'viem'
import { useAccount } from 'wagmi'
import { CHAIN_CONFIGS, arcMainnet, arcTestnet } from '@/lib/chain'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import {
  LOGS_RPCS,
  getLogsClient,
  logsWithBackoff,
  sleep,
  BETWEEN_CHUNKS_MS,
  loadFromStorage,
  saveToStorage,
} from '@/lib/logs-client'
import { fetchExplorerLogs } from '@/lib/explorer-api'

// ── Deploy blocks ─────────────────────────────────────────────────────────────
const DEPLOY_BLOCK: Record<number, bigint> = {
  [arcMainnet.id]: 27_849_693n,
  [arcTestnet.id]: 0n,
}
const CHUNK_SIZE = 2_000n

// ── Event selectors (for RPC fallback path) ───────────────────────────────────
const EV_CONTRIBUTED  = parseAbiItem('event Contributed(uint256 indexed potId, uint256 indexed round, address indexed member)')
const EV_CLOSED       = parseAbiItem('event RoundClosed(uint256 indexed potId, uint256 round, address indexed recipient, uint256 amount)')
const EV_CANCELLED    = parseAbiItem('event RoundCancelled(uint256 indexed potId, uint256 round)')
const EV_WITHDRAWN    = parseAbiItem('event Withdrawn(address indexed account, uint256 amount)')
const EV_WITHDRAWN_TO = parseAbiItem('event WithdrawnTo(address indexed account, address indexed recipient, uint256 amount)')

// ── Types ─────────────────────────────────────────────────────────────────────
export type ActivityType = 'Contributed' | 'ReceivedPot' | 'RefundCredited' | 'Withdrawn'

export interface ActivityRow {
  type:        ActivityType
  potId:       bigint | null
  amount:      bigint
  blockNumber: bigint
  txHash:      `0x${string}`
  timestamp:   number
  actor:       string
}

// Raw decoded log row (persisted to localStorage as JSON)
interface RawLog {
  type: 'Contributed' | 'RoundClosed' | 'RoundCancelled' | 'Withdrawn' | 'WithdrawnTo'
  blockNumber: string   // decimal string (JSON can't handle bigint)
  txHash:      string
  timestamp?:  number   // unix seconds — present when from explorer API
  potId?:      string
  round?:      string
  member?:     string
  recipient?:  string
  amount?:     string
  account?:    string
}

// In-memory row (bigints restored from strings)
interface MemRow {
  type:        RawLog['type']
  blockNumber: bigint
  txHash:      `0x${string}`
  timestamp:   number
  potId?:      bigint
  round?:      bigint
  member?:     string
  recipient?:  string
  amount?:     bigint
  account?:    string
}

function rawToMem(r: RawLog): MemRow {
  return {
    type:       r.type,
    blockNumber: BigInt(r.blockNumber),
    txHash:     r.txHash as `0x${string}`,
    timestamp:  r.timestamp ?? 0,
    potId:      r.potId      !== undefined ? BigInt(r.potId)  : undefined,
    round:      r.round      !== undefined ? BigInt(r.round)  : undefined,
    amount:     r.amount     !== undefined ? BigInt(r.amount) : undefined,
    member:     r.member,
    recipient:  r.recipient,
    account:    r.account,
  }
}

function memToRaw(m: MemRow): RawLog {
  return {
    type:        m.type,
    blockNumber: m.blockNumber.toString(),
    txHash:      m.txHash,
    timestamp:   m.timestamp,
    potId:       m.potId?.toString(),
    round:       m.round?.toString(),
    amount:      m.amount?.toString(),
    member:      m.member,
    recipient:   m.recipient,
    account:     m.account,
  }
}

// ── In-memory cache ───────────────────────────────────────────────────────────
interface CacheEntry {
  rows:      MemRow[]
  scannedTo: bigint
  loading:   boolean
  failed:    boolean
  listeners: Set<() => void>
}

const CACHE = new Map<number, CacheEntry>()

function getOrCreate(chainId: number, turnpotAddress: string): CacheEntry {
  if (!CACHE.has(chainId)) {
    const stored = loadFromStorage<RawLog>(chainId, turnpotAddress)
    const rows = stored ? stored.rows.map(rawToMem) : []
    const scannedTo = stored
      ? BigInt(stored.scannedTo)
      : (DEPLOY_BLOCK[chainId] ?? 0n)
    CACHE.set(chainId, { rows, scannedTo, loading: false, failed: false, listeners: new Set() })
  }
  return CACHE.get(chainId)!
}

// ── Explorer-API decode helpers ───────────────────────────────────────────────

function decodeExplorerRows(
  logs: Awaited<ReturnType<typeof fetchExplorerLogs>>,
  fromBlock: bigint,
): MemRow[] {
  const rows: MemRow[] = []
  for (const log of logs) {
    if (log.blockNumber < fromBlock) continue   // already in cache
    // Try each event type; skip logs that don't match any
    try {
      const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'Contributed',   topics: log.topics, data: log.data, strict: false })
      rows.push({ type: 'Contributed',   blockNumber: log.blockNumber, txHash: log.transactionHash, timestamp: log.timestamp, potId: d.args.potId, round: d.args.round, member: d.args.member?.toLowerCase() })
      continue
    } catch { /* not this event */ }
    try {
      const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'RoundClosed',   topics: log.topics, data: log.data, strict: false })
      rows.push({ type: 'RoundClosed',   blockNumber: log.blockNumber, txHash: log.transactionHash, timestamp: log.timestamp, potId: d.args.potId, round: d.args.round, recipient: d.args.recipient?.toLowerCase(), amount: d.args.amount })
      continue
    } catch { /* not this event */ }
    try {
      const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'RoundCancelled', topics: log.topics, data: log.data, strict: false })
      rows.push({ type: 'RoundCancelled', blockNumber: log.blockNumber, txHash: log.transactionHash, timestamp: log.timestamp, potId: d.args.potId, round: d.args.round })
      continue
    } catch { /* not this event */ }
    try {
      const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'Withdrawn',      topics: log.topics, data: log.data, strict: false })
      rows.push({ type: 'Withdrawn',      blockNumber: log.blockNumber, txHash: log.transactionHash, timestamp: log.timestamp, account: d.args.account?.toLowerCase(), amount: d.args.amount })
      continue
    } catch { /* not this event */ }
    try {
      const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'WithdrawnTo',    topics: log.topics, data: log.data, strict: false })
      rows.push({ type: 'WithdrawnTo',    blockNumber: log.blockNumber, txHash: log.transactionHash, timestamp: log.timestamp, account: d.args.account?.toLowerCase(), amount: d.args.amount })
    } catch { /* not a known event — skip */ }
  }
  return rows
}

// ── Core fetch ────────────────────────────────────────────────────────────────
async function fetchLogs(chainId: number, turnpotAddress: `0x${string}`) {
  const entry = getOrCreate(chainId, turnpotAddress)
  if (entry.loading) return
  entry.loading = true
  entry.failed  = false
  entry.listeners.forEach((fn) => fn())

  const cfg = CHAIN_CONFIGS[chainId]
  if (!cfg) { entry.loading = false; return }

  const deployBlock = DEPLOY_BLOCK[chainId] ?? 0n

  // ── Path 1: Explorer API ──────────────────────────────────────────────────
  try {
    const fromNum = entry.scannedTo > deployBlock
      ? Number(entry.scannedTo) + 1
      : Number(deployBlock)

    const logs = await fetchExplorerLogs(chainId, turnpotAddress, fromNum, 'latest')
    const newRows = decodeExplorerRows(logs, BigInt(fromNum))

    entry.rows.push(...newRows)

    // Derive the highest block seen (or keep scannedTo if no new logs)
    if (newRows.length > 0) {
      const maxBlock = newRows.reduce((m, r) => r.blockNumber > m ? r.blockNumber : m, 0n)
      entry.scannedTo = maxBlock
    }

    saveToStorage<RawLog>(chainId, turnpotAddress, entry.scannedTo, entry.rows.map(memToRaw))
    entry.loading = false
    entry.listeners.forEach((fn) => fn())
    return
  } catch {
    // Explorer API failed — fall through to RPC scan
  }

  // ── Path 2: RPC scan (fallback) ───────────────────────────────────────────
  const rpcs = LOGS_RPCS[chainId] ?? []
  if (rpcs.length === 0) { entry.loading = false; return }

  let lastError: unknown

  for (const rpcUrl of rpcs) {
    const client = getLogsClient(chainId, rpcUrl)
    try {
      const latest = await client.getBlockNumber()
      const from   = entry.scannedTo > 0n ? entry.scannedTo + 1n : deployBlock

      if (from > latest) { lastError = undefined; break }

      let cur = from
      while (cur <= latest) {
        const to = cur + CHUNK_SIZE - 1n < latest ? cur + CHUNK_SIZE - 1n : latest

        const contributed = await logsWithBackoff(() =>
          client.getLogs({ address: turnpotAddress, event: EV_CONTRIBUTED,  fromBlock: cur, toBlock: to }))
        await sleep(BETWEEN_CHUNKS_MS)
        const closed = await logsWithBackoff(() =>
          client.getLogs({ address: turnpotAddress, event: EV_CLOSED,       fromBlock: cur, toBlock: to }))
        await sleep(BETWEEN_CHUNKS_MS)
        const cancelled = await logsWithBackoff(() =>
          client.getLogs({ address: turnpotAddress, event: EV_CANCELLED,    fromBlock: cur, toBlock: to }))
        await sleep(BETWEEN_CHUNKS_MS)
        const withdrawn = await logsWithBackoff(() =>
          client.getLogs({ address: turnpotAddress, event: EV_WITHDRAWN,    fromBlock: cur, toBlock: to }))
        await sleep(BETWEEN_CHUNKS_MS)
        const withdrawnTo = await logsWithBackoff(() =>
          client.getLogs({ address: turnpotAddress, event: EV_WITHDRAWN_TO, fromBlock: cur, toBlock: to }))

        const newRows: MemRow[] = []
        for (const log of contributed) {
          try {
            const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'Contributed',    topics: log.topics, data: log.data })
            newRows.push({ type: 'Contributed',   blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', timestamp: 0, potId: d.args.potId, round: d.args.round, member: d.args.member?.toLowerCase() })
          } catch { /* skip */ }
        }
        for (const log of closed) {
          try {
            const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'RoundClosed',    topics: log.topics, data: log.data })
            newRows.push({ type: 'RoundClosed',   blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', timestamp: 0, potId: d.args.potId, round: d.args.round, recipient: d.args.recipient?.toLowerCase(), amount: d.args.amount })
          } catch { /* skip */ }
        }
        for (const log of cancelled) {
          try {
            const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'RoundCancelled', topics: log.topics, data: log.data })
            newRows.push({ type: 'RoundCancelled', blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', timestamp: 0, potId: d.args.potId, round: d.args.round })
          } catch { /* skip */ }
        }
        for (const log of withdrawn) {
          try {
            const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'Withdrawn',      topics: log.topics, data: log.data })
            newRows.push({ type: 'Withdrawn',      blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', timestamp: 0, account: d.args.account?.toLowerCase(), amount: d.args.amount })
          } catch { /* skip */ }
        }
        for (const log of withdrawnTo) {
          try {
            const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'WithdrawnTo',    topics: log.topics, data: log.data })
            newRows.push({ type: 'WithdrawnTo',    blockNumber: log.blockNumber ?? 0n, txHash: log.transactionHash ?? '0x', timestamp: 0, account: d.args.account?.toLowerCase(), amount: d.args.amount })
          } catch { /* skip */ }
        }

        entry.rows.push(...newRows)
        entry.scannedTo = to
        cur = to + 1n

        saveToStorage<RawLog>(chainId, turnpotAddress, entry.scannedTo, entry.rows.map(memToRaw))
        entry.listeners.forEach((fn) => fn())

        if (cur <= latest) await sleep(BETWEEN_CHUNKS_MS)
      }

      entry.scannedTo = latest
      lastError = undefined
      break
    } catch (err) {
      lastError = err
    }
  }

  if (lastError !== undefined) entry.failed = true
  entry.loading = false
  entry.listeners.forEach((fn) => fn())
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPotsPaidIn(rows: MemRow[], walletLower: string): Set<bigint> {
  const s = new Set<bigint>()
  for (const r of rows) {
    if (r.type === 'Contributed' && r.member === walletLower && r.potId !== undefined) {
      s.add(r.potId)
    }
  }
  return s
}

function toActivityRows(rows: MemRow[], walletLower: string): ActivityRow[] {
  const potsPaidIn = getPotsPaidIn(rows, walletLower)
  const result: ActivityRow[] = []

  for (const r of rows) {
    if (r.type === 'Contributed' && r.member === walletLower) {
      result.push({ type: 'Contributed',    potId: r.potId ?? null, amount: r.amount ?? 0n, blockNumber: r.blockNumber, txHash: r.txHash, timestamp: r.timestamp, actor: walletLower })
    } else if (r.type === 'RoundClosed' && r.recipient === walletLower) {
      result.push({ type: 'ReceivedPot',    potId: r.potId ?? null, amount: r.amount ?? 0n, blockNumber: r.blockNumber, txHash: r.txHash, timestamp: r.timestamp, actor: walletLower })
    } else if (r.type === 'RoundCancelled' && r.potId !== undefined && potsPaidIn.has(r.potId)) {
      result.push({ type: 'RefundCredited', potId: r.potId,         amount: 0n,             blockNumber: r.blockNumber, txHash: r.txHash, timestamp: r.timestamp, actor: walletLower })
    } else if ((r.type === 'Withdrawn' || r.type === 'WithdrawnTo') && r.account === walletLower) {
      result.push({ type: 'Withdrawn',      potId: null,            amount: r.amount ?? 0n, blockNumber: r.blockNumber, txHash: r.txHash, timestamp: r.timestamp, actor: walletLower })
    }
  }

  result.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0))
  return result
}

// ── Shared manual-refresh trigger ─────────────────────────────────────────────
type RefreshFn = () => void
const _refreshListeners = new Set<RefreshFn>()
export function refreshActivityLogs() { _refreshListeners.forEach((fn) => fn()) }

// ── Internal subscribe hook ───────────────────────────────────────────────────
function useCacheSubscribe(chainId: number | undefined, turnpotAddress: string) {
  const [, forceUpdate] = useState(0)

  const doFetch = useCallback(() => {
    if (!chainId || !turnpotAddress) return
    void fetchLogs(chainId, turnpotAddress as `0x${string}`)
  }, [chainId, turnpotAddress])

  useEffect(() => {
    if (!chainId || !turnpotAddress) return
    const entry = getOrCreate(chainId, turnpotAddress)
    const update = () => forceUpdate((n) => n + 1)
    entry.listeners.add(update)
    _refreshListeners.add(doFetch)

    if (!entry.loading) void fetchLogs(chainId, turnpotAddress as `0x${string}`)

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

// ── Public hook ───────────────────────────────────────────────────────────────
export function useWalletActivity(address: `0x${string}` | undefined) {
  const { chainId } = useAccount()
  const cfg = chainId !== undefined ? CHAIN_CONFIGS[chainId] : undefined
  const turnpotAddress = cfg?.turnpotAddress ?? ''

  const { rows, loading, failed, refresh } = useCacheSubscribe(
    cfg ? chainId : undefined,
    turnpotAddress,
  )

  const walletLower = address?.toLowerCase() ?? ''
  const activity = walletLower ? toActivityRows(rows, walletLower) : []

  return { activity, loading, failed, refresh }
}
