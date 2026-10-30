/**
 * PotHistory — on-chain event log for a single pot.
 *
 * Load strategy (rate-limit friendly):
 *   1. Initial load: fetch the last INITIAL_BLOCKS blocks (most recent events).
 *   2. "Load more" button: walk backwards in CHUNK-block windows one at a time
 *      (sequential, never parallel) down to the deploy block.
 *   3. Never fromBlock=0; earliest allowed is MAINNET_DEPLOY_BLOCK.
 *   4. RPC errors: exponential backoff 1s→2s→4s before showing the error state.
 *
 * Events:
 *   Contributed(potId indexed, round indexed, member indexed)
 *   RoundClosed(potId indexed, round, recipient indexed, amount)
 *   RoundCancelled(potId indexed, round)
 *   Withdrawn(account indexed, amount) — filtered to pot members only
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { usePublicClient } from 'wagmi'
import { decodeEventLog } from 'viem'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { useActiveChainConfig, explorerTx } from '@/lib/chain'
import { fmtUsdc, fmtAddr } from '@/lib/format'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useI18n } from '@/i18n'
import {
  LOGS_RPCS,
  getLogsClient,
  logsWithBackoff,
  sleep,
  BETWEEN_CHUNKS_MS,
} from '@/lib/logs-client'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAINNET_DEPLOY_BLOCK = 27_849_693n
const INITIAL_BLOCKS = 20n      // first load covers last N blocks
const CHUNK         = 2_000n    // each subsequent "load more" chunk

// ── Types ─────────────────────────────────────────────────────────────────────

type EventKind = 'Contributed' | 'RoundClosed' | 'RoundCancelled' | 'Withdrawn'

interface HistoryEntry {
  kind: EventKind
  blockNumber: bigint
  txHash: `0x${string}`
  label: string
  timeLabel: string
}

// ── Raw log shape ─────────────────────────────────────────────────────────────

interface RawLog {
  blockNumber: bigint | null
  transactionHash: `0x${string}` | null
  topics: [`0x${string}`, ...`0x${string}`[]] | []
  data: `0x${string}`
}

// ── Block timestamp cache ─────────────────────────────────────────────────────

const tsCache = new Map<string, number>()

async function getBlockTs(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  chainId: number,
  blockNumber: bigint,
): Promise<number> {
  const key = `${chainId}:${blockNumber}`
  if (tsCache.has(key)) return tsCache.get(key)!
  try {
    const blk = await client.getBlock({ blockNumber })
    const ts = Number(blk.timestamp)
    tsCache.set(key, ts)
    return ts
  } catch {
    return 0
  }
}

function fmtRelative(ts: number): string {
  if (!ts) return ''
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Fetch a single block range via the dedicated logs client ─────────────────
// Returns null when all retries exhausted (caller shows the busy/retry UI).
async function fetchRangeWithLogsClient(
  chainId: number,
  addr: `0x${string}`,
  potId: bigint,
  from: bigint,
  to: bigint,
): Promise<{ contributed: RawLog[]; closed: RawLog[]; cancelled: RawLog[]; withdrawn: RawLog[] } | null> {
  const rpcs = LOGS_RPCS[chainId] ?? []
  for (const rpcUrl of rpcs) {
    const client = getLogsClient(chainId, rpcUrl)
    try {
      // Sequential: one event type at a time + 300ms pause between calls
      const contributed = (await logsWithBackoff(() => client.getLogs({
        address: addr,
        event: { type: 'event', name: 'Contributed', inputs: [
          { name: 'potId',  type: 'uint256', indexed: true },
          { name: 'round',  type: 'uint256', indexed: true },
          { name: 'member', type: 'address', indexed: true },
        ] } as const,
        args: { potId }, fromBlock: from, toBlock: to,
      }))) as RawLog[]
      await sleep(BETWEEN_CHUNKS_MS)

      const closed = (await logsWithBackoff(() => client.getLogs({
        address: addr,
        event: { type: 'event', name: 'RoundClosed', inputs: [
          { name: 'potId',     type: 'uint256', indexed: true },
          { name: 'round',     type: 'uint256', indexed: false },
          { name: 'recipient', type: 'address', indexed: true },
          { name: 'amount',    type: 'uint256', indexed: false },
        ] } as const,
        args: { potId }, fromBlock: from, toBlock: to,
      }))) as RawLog[]
      await sleep(BETWEEN_CHUNKS_MS)

      const cancelled = (await logsWithBackoff(() => client.getLogs({
        address: addr,
        event: { type: 'event', name: 'RoundCancelled', inputs: [
          { name: 'potId',  type: 'uint256', indexed: true },
          { name: 'round',  type: 'uint256', indexed: false },
        ] } as const,
        args: { potId }, fromBlock: from, toBlock: to,
      }))) as RawLog[]
      await sleep(BETWEEN_CHUNKS_MS)

      const withdrawn = (await logsWithBackoff(() => client.getLogs({
        address: addr,
        event: { type: 'event', name: 'Withdrawn', inputs: [
          { name: 'account', type: 'address', indexed: true },
          { name: 'amount',  type: 'uint256', indexed: false },
        ] } as const,
        fromBlock: from, toBlock: to,
      }))) as RawLog[]

      return { contributed, closed, cancelled, withdrawn }
    } catch {
      // Try next RPC in the list
    }
  }
  return null
}

// ── Decode range logs → HistoryEntry[] ────────────────────────────────────────

function decodeLogs(
  { contributed, closed, cancelled, withdrawn }: {
    contributed: RawLog[]; closed: RawLog[]; cancelled: RawLog[]; withdrawn: RawLog[]
  },
  memberSet: Set<string>,
  t: (k: string, v?: Record<string, string>) => string,
): HistoryEntry[] {
  const all: HistoryEntry[] = []

  for (const log of contributed) {
    try {
      const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'Contributed', topics: log.topics, data: log.data })
      all.push({
        kind: 'Contributed',
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? '0x',
        label: t('history.contributed', { round: String(Number(d.args.round) + 1), addr: fmtAddr(d.args.member), amount: '—' }),
        timeLabel: '',
      })
    } catch { /* skip */ }
  }
  for (const log of closed) {
    try {
      const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'RoundClosed', topics: log.topics, data: log.data })
      all.push({
        kind: 'RoundClosed',
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? '0x',
        label: t('history.closed', { round: String(Number(d.args.round) + 1), amount: fmtUsdc(d.args.amount), addr: fmtAddr(d.args.recipient) }),
        timeLabel: '',
      })
    } catch { /* skip */ }
  }
  for (const log of cancelled) {
    try {
      const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'RoundCancelled', topics: log.topics, data: log.data })
      all.push({
        kind: 'RoundCancelled',
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? '0x',
        label: t('history.cancelled', { round: String(Number(d.args.round) + 1) }),
        timeLabel: '',
      })
    } catch { /* skip */ }
  }
  for (const log of withdrawn) {
    try {
      const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'Withdrawn', topics: log.topics, data: log.data })
      if (!memberSet.has((d.args.account ?? '').toLowerCase())) continue
      all.push({
        kind: 'Withdrawn',
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? '0x',
        label: t('history.withdrawn', { addr: fmtAddr(d.args.account), amount: fmtUsdc(d.args.amount) }),
        timeLabel: '',
      })
    } catch { /* skip */ }
  }

  return all
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PotHistoryProps {
  potId: bigint
  members: readonly `0x${string}`[]
}

export default function PotHistory({ potId, members }: PotHistoryProps) {
  const { chainId: activeChainId, turnpotAddress, isTestnet } = useActiveChainConfig()
  // usePublicClient is used ONLY for getBlock (timestamps) — NOT for getLogs.
  // getLogs always goes through getLogsClient (logs-client.ts) to avoid hitting
  // the Chainstack full-node endpoint which rejects archive getLogs.
  const wagmiClient = usePublicClient({ chainId: activeChainId })
  const { t } = useI18n()

  const deployBlock = isTestnet ? 0n : MAINNET_DEPLOY_BLOCK

  const [entries,      setEntries]      = useState<HistoryEntry[]>([])
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [failed,       setFailed]       = useState(false)
  const [busyRetries,  setBusyRetries]  = useState(0)  // consecutive 429/backoff count
  const [canLoadMore,  setCanLoadMore]  = useState(false)
  // nextFrom: the next older block to load from (walk backwards)
  const nextFromRef = useRef<bigint | null>(null)

  const memberSet = useRef(new Set<string>())
  memberSet.current = new Set(members.map((m) => m.toLowerCase()))

  // Resolve timestamps for the top N entries
  const resolveTimestamps = useCallback(async (list: HistoryEntry[]) => {
    if (!wagmiClient) return
    const top = list.slice(0, 20)
    const timestamps = await Promise.all(
      top.map((e) => getBlockTs(wagmiClient, activeChainId ?? 0, e.blockNumber)),
    )
    setEntries((prev) => {
      const updated = [...prev]
      for (let i = 0; i < top.length; i++) {
        const idx = updated.indexOf(top[i])
        if (idx >= 0 && timestamps[i]) {
          updated[idx] = { ...updated[idx], timeLabel: fmtRelative(timestamps[i]) }
        }
      }
      return updated
    })
  }, [wagmiClient, activeChainId])

  // Initial load: last INITIAL_BLOCKS blocks
  const loadInitial = useCallback(async () => {
    if (!wagmiClient || !turnpotAddress || activeChainId === undefined) return
    setLoading(true)
    setFailed(false)
    setBusyRetries(0)
    setEntries([])

    const addr = turnpotAddress
    try {
      const latest = await wagmiClient.getBlockNumber()
      const from = latest > INITIAL_BLOCKS ? latest - INITIAL_BLOCKS : deployBlock
      const clampedFrom = from < deployBlock ? deployBlock : from

      const result = await fetchRangeWithLogsClient(activeChainId, addr, potId, clampedFrom, latest)
      if (result === null) {
        setFailed(true)
        setLoading(false)
        return
      }

      const decoded = decodeLogs(result, memberSet.current, t)
      decoded.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0))
      setEntries(decoded)

      // Set up "load more" cursor: next chunk starts just before clampedFrom
      if (clampedFrom > deployBlock) {
        nextFromRef.current = clampedFrom - 1n
        setCanLoadMore(true)
      } else {
        nextFromRef.current = null
        setCanLoadMore(false)
      }

      void resolveTimestamps(decoded)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potId, wagmiClient, turnpotAddress, activeChainId, t, deployBlock])

  // Load more: one 2000-block chunk backwards, sequential
  const loadMore = useCallback(async () => {
    if (!wagmiClient || !turnpotAddress || nextFromRef.current === null || loadingMore || activeChainId === undefined) return
    setLoadingMore(true)
    setBusyRetries(0)

    const addr  = turnpotAddress
    const to    = nextFromRef.current
    const from  = to >= CHUNK ? to - CHUNK + 1n : deployBlock
    const clampedFrom = from < deployBlock ? deployBlock : from

    const result = await fetchRangeWithLogsClient(activeChainId, addr, potId, clampedFrom, to)
    if (result === null) {
      setBusyRetries((n) => n + 1)
      setLoadingMore(false)
      return
    }

    const decoded = decodeLogs(result, memberSet.current, t)
    decoded.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0))
    setEntries((prev) => [...prev, ...decoded])

    if (clampedFrom > deployBlock) {
      nextFromRef.current = clampedFrom - 1n
      setCanLoadMore(true)
    } else {
      nextFromRef.current = null
      setCanLoadMore(false)
    }

    void resolveTimestamps(decoded)
    setLoadingMore(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potId, wagmiClient, turnpotAddress, activeChainId, t, deployBlock, loadingMore])

  useEffect(() => { void loadInitial() }, [loadInitial])

  // ── Dot colours ────────────────────────────────────────────────────────────

  const dot: Record<EventKind, string> = {
    Contributed:    '#2775CA',
    RoundClosed:    'var(--success)',
    RoundCancelled: 'var(--danger)',
    Withdrawn:      'var(--accent-hover)',
  }

  // ── Skeleton ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-label={t('history.loading')}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-3" style={{ background: 'var(--surface-muted)' }}>
            <div className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full" style={{ background: 'var(--border)' }} />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="h-3.5 w-3/4 animate-pulse rounded" style={{ background: 'var(--border)' }} />
              <div className="h-3 w-1/3 animate-pulse rounded" style={{ background: 'var(--border)' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (failed) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--danger)' }}>
        <span>{t('history.error')}</span>
        <button
          onClick={() => { void loadInitial() }}
          className="flex items-center gap-1 text-xs underline underline-offset-2 hover:no-underline"
          style={{ color: 'var(--brand)' }}
        >
          <RefreshCw className="size-3" />
          {t('history.retry')}
        </button>
      </div>
    )
  }

  // ── Empty ──────────────────────────────────────────────────────────────────

  if (entries.length === 0 && !canLoadMore) {
    return <p className="text-sm" style={{ color: 'var(--subtle)' }}>{t('history.empty')}</p>
  }

  // ── List ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      <ul className="space-y-2" role="list">
        {entries.map((e, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-muted)' }}>
            <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: dot[e.kind] }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug" style={{ color: 'var(--ink-2)' }}>{e.label}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {e.timeLabel && (
                  <span className="text-xs" style={{ color: 'var(--subtle)' }}>{e.timeLabel}</span>
                )}
                {e.blockNumber > 0n && (
                  <span className="mono text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
                    #{String(e.blockNumber)}
                  </span>
                )}
                {e.txHash && e.txHash !== '0x' && (
                  <a
                    href={explorerTx(e.txHash, activeChainId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--brand)' }}
                  >
                    {t('history.viewArcscan')} <ExternalLink className="size-2.5" />
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* "Network busy" notice after repeated backoffs */}
      {busyRetries >= 3 && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
          <span>{t('rpc.busy')}</span>
          <button
            onClick={() => { setBusyRetries(0); void loadMore() }}
            className="underline underline-offset-2 hover:no-underline"
            style={{ color: 'var(--brand)' }}
          >
            {t('rpc.retry')}
          </button>
        </div>
      )}

      {/* Load more button */}
      {canLoadMore && (
        <button
          onClick={() => { void loadMore() }}
          disabled={loadingMore}
          className="flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-opacity hover:opacity-70 disabled:opacity-50"
          style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
        >
          {loadingMore
            ? <><RefreshCw className="size-3 animate-spin" /> {t('history.loadingMore')}</>
            : t('history.loadMore')
          }
        </button>
      )}
    </div>
  )
}
