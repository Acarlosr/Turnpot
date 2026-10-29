/**
 * PotHistory — on-chain event log for a single pot.
 *
 * Events fetched (from deploy block, chunked 5 000 blocks each):
 *   Contributed(potId indexed, round indexed, member indexed)
 *   RoundClosed(potId indexed, round, recipient indexed, amount)
 *   RoundCancelled(potId indexed, round)
 *   Withdrawn(account indexed, amount) — filtered to pot members
 *
 * All entries sorted by block number, newest first.
 */
import { useEffect, useState, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { decodeEventLog } from 'viem'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { useActiveChainConfig, explorerTx } from '@/lib/chain'
import { fmtUsdc, fmtAddr } from '@/lib/format'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useI18n } from '@/i18n'

// ── Constants ─────────────────────────────────────────────────────────────────

const MAINNET_DEPLOY_BLOCK = 27_849_693n
const CHUNK = 5_000n

// ── Types ─────────────────────────────────────────────────────────────────────

type EventKind = 'Contributed' | 'RoundClosed' | 'RoundCancelled' | 'Withdrawn'

interface HistoryEntry {
  kind: EventKind
  blockNumber: bigint
  txHash: `0x${string}`
  label: string
  timeLabel: string
}

// ── Raw log shape returned by viem getLogs ────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

interface PotHistoryProps {
  potId: bigint
  members: readonly `0x${string}`[]
}

export default function PotHistory({ potId, members }: PotHistoryProps) {
  const { chainId: activeChainId, turnpotAddress, isTestnet } = useActiveChainConfig()
  const client = usePublicClient({ chainId: activeChainId })
  const { t } = useI18n()

  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [failed,  setFailed]  = useState(false)

  const deployBlock = isTestnet ? 0n : MAINNET_DEPLOY_BLOCK

  const load = useCallback(async () => {
    if (!client || !turnpotAddress) return
    setLoading(true)
    setFailed(false)

    const addr = turnpotAddress
    const memberSet = new Set(members.map((m) => m.toLowerCase()))

    try {
      const latest = await client.getBlockNumber()

      // ── Chunked fetch for each event type ────────────────────────────────

      async function fetchContributed(): Promise<RawLog[]> {
        const out: RawLog[] = []
        for (let cur = deployBlock; cur <= latest; cur += CHUNK) {
          const to = cur + CHUNK - 1n < latest ? cur + CHUNK - 1n : latest
          const logs = await client!.getLogs({
            address: addr,
            event: { type: 'event', name: 'Contributed', inputs: [
              { name: 'potId',  type: 'uint256', indexed: true },
              { name: 'round',  type: 'uint256', indexed: true },
              { name: 'member', type: 'address', indexed: true },
            ] } as const,
            args: { potId },
            fromBlock: cur,
            toBlock: to,
          })
          out.push(...logs)
        }
        return out
      }

      async function fetchClosed(): Promise<RawLog[]> {
        const out: RawLog[] = []
        for (let cur = deployBlock; cur <= latest; cur += CHUNK) {
          const to = cur + CHUNK - 1n < latest ? cur + CHUNK - 1n : latest
          const logs = await client!.getLogs({
            address: addr,
            event: { type: 'event', name: 'RoundClosed', inputs: [
              { name: 'potId',     type: 'uint256', indexed: true },
              { name: 'round',     type: 'uint256', indexed: false },
              { name: 'recipient', type: 'address', indexed: true },
              { name: 'amount',    type: 'uint256', indexed: false },
            ] } as const,
            args: { potId },
            fromBlock: cur,
            toBlock: to,
          })
          out.push(...logs)
        }
        return out
      }

      async function fetchCancelled(): Promise<RawLog[]> {
        const out: RawLog[] = []
        for (let cur = deployBlock; cur <= latest; cur += CHUNK) {
          const to = cur + CHUNK - 1n < latest ? cur + CHUNK - 1n : latest
          const logs = await client!.getLogs({
            address: addr,
            event: { type: 'event', name: 'RoundCancelled', inputs: [
              { name: 'potId',  type: 'uint256', indexed: true },
              { name: 'round',  type: 'uint256', indexed: false },
            ] } as const,
            args: { potId },
            fromBlock: cur,
            toBlock: to,
          })
          out.push(...logs)
        }
        return out
      }

      async function fetchWithdrawn(): Promise<RawLog[]> {
        const out: RawLog[] = []
        for (let cur = deployBlock; cur <= latest; cur += CHUNK) {
          const to = cur + CHUNK - 1n < latest ? cur + CHUNK - 1n : latest
          const logs = await client!.getLogs({
            address: addr,
            event: { type: 'event', name: 'Withdrawn', inputs: [
              { name: 'account', type: 'address', indexed: true },
              { name: 'amount',  type: 'uint256', indexed: false },
            ] } as const,
            fromBlock: cur,
            toBlock: to,
          })
          out.push(...logs)
        }
        return out
      }

      const [contributed, closed, cancelled, withdrawn] = await Promise.all([
        fetchContributed(),
        fetchClosed(),
        fetchCancelled(),
        fetchWithdrawn(),
      ])

      const all: HistoryEntry[] = []

      for (const log of contributed) {
        try {
          const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'Contributed', topics: log.topics, data: log.data })
          all.push({
            kind: 'Contributed',
            blockNumber: log.blockNumber ?? 0n,
            txHash: log.transactionHash ?? '0x',
            label: t('history.contributed', {
              round:  String(Number(d.args.round) + 1),
              addr:   fmtAddr(d.args.member),
              amount: '—',  // Contributed event carries no amount field
            }),
            timeLabel: '',
          })
        } catch { /* skip malformed log */ }
      }

      for (const log of closed) {
        try {
          const d = decodeEventLog({ abi: TURNPOT_ABI, eventName: 'RoundClosed', topics: log.topics, data: log.data })
          all.push({
            kind: 'RoundClosed',
            blockNumber: log.blockNumber ?? 0n,
            txHash: log.transactionHash ?? '0x',
            label: t('history.closed', {
              round:  String(Number(d.args.round) + 1),
              amount: fmtUsdc(d.args.amount),
              addr:   fmtAddr(d.args.recipient),
            }),
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
            label: t('history.withdrawn', {
              addr:   fmtAddr(d.args.account),
              amount: fmtUsdc(d.args.amount),
            }),
            timeLabel: '',
          })
        } catch { /* skip */ }
      }

      all.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0))
      setEntries(all)

      // Lazily resolve block timestamps for the top 20 entries
      const top = all.slice(0, 20)
      const timestamps = await Promise.all(
        top.map((e) => getBlockTs(client, activeChainId ?? 0, e.blockNumber)),
      )
      setEntries((prev) =>
        prev.map((e, i) => {
          const ts = timestamps[i]
          return ts !== undefined ? { ...e, timeLabel: fmtRelative(ts) } : e
        }),
      )
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potId, client, turnpotAddress, activeChainId, t, deployBlock])
  // members/memberSet deliberately omitted — changes every render but content is stable

  useEffect(() => { void load() }, [load])

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
          onClick={() => { void load() }}
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

  if (entries.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--subtle)' }}>{t('history.empty')}</p>
  }

  // ── List ───────────────────────────────────────────────────────────────────

  return (
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
  )
}
