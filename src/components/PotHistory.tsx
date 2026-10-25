/**
 * History of RoundClosed, RoundCancelled, Withdrawn events for a given pot.
 * Uses wagmi useWatchContractEvent + a local log buffer.
 */
import { useEffect, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem, decodeEventLog } from 'viem'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { TURNPOT_ADDRESS, TARGET_CHAIN_ID, explorerTx } from '@/lib/chain'
import { fmtUsdc, fmtAddr } from '@/lib/format'
import { ExternalLink } from 'lucide-react'

interface HistoryEntry {
  type: 'RoundClosed' | 'RoundCancelled' | 'Withdrawn'
  blockNumber: bigint
  txHash: `0x${string}`
  label: string
}

const CLOSED_TOPIC = parseAbiItem(
  'event RoundClosed(uint256 indexed potId, uint256 round, address indexed recipient, uint256 amount)',
)
const CANCELLED_TOPIC = parseAbiItem(
  'event RoundCancelled(uint256 indexed potId, uint256 round)',
)
const WITHDRAWN_TOPIC = parseAbiItem(
  'event Withdrawn(address indexed account, uint256 amount)',
)

export default function PotHistory({ potId }: { potId: bigint }) {
  const client = usePublicClient({ chainId: TARGET_CHAIN_ID })
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!client) return
    let cancelled = false

    async function load() {
      if (!client) return
      try {
        const [closed, cancelled2, withdrawn] = await Promise.all([
          client.getLogs({
            address: TURNPOT_ADDRESS,
            event: CLOSED_TOPIC,
            args: { potId },
            fromBlock: 0n,
            toBlock: 'latest',
          }),
          client.getLogs({
            address: TURNPOT_ADDRESS,
            event: CANCELLED_TOPIC,
            args: { potId },
            fromBlock: 0n,
            toBlock: 'latest',
          }),
          client.getLogs({
            address: TURNPOT_ADDRESS,
            event: WITHDRAWN_TOPIC,
            fromBlock: 0n,
            toBlock: 'latest',
          }),
        ])

        if (cancelled) return

        const all: HistoryEntry[] = []

        for (const log of closed) {
          const d = decodeEventLog({
            abi: TURNPOT_ABI,
            eventName: 'RoundClosed',
            topics: log.topics,
            data: log.data,
          })
          all.push({
            type: 'RoundClosed',
            blockNumber: log.blockNumber ?? 0n,
            txHash: log.transactionHash ?? '0x',
            label: `Round ${d.args.round} closed — ${fmtUsdc(d.args.amount)} USDC to ${fmtAddr(d.args.recipient)}`,
          })
        }

        for (const log of cancelled2) {
          const d = decodeEventLog({
            abi: TURNPOT_ABI,
            eventName: 'RoundCancelled',
            topics: log.topics,
            data: log.data,
          })
          all.push({
            type: 'RoundCancelled',
            blockNumber: log.blockNumber ?? 0n,
            txHash: log.transactionHash ?? '0x',
            label: `Round ${d.args.round} cancelled`,
          })
        }

        for (const log of withdrawn) {
          const d = decodeEventLog({
            abi: TURNPOT_ABI,
            eventName: 'Withdrawn',
            topics: log.topics,
            data: log.data,
          })
          all.push({
            type: 'Withdrawn',
            blockNumber: log.blockNumber ?? 0n,
            txHash: log.transactionHash ?? '0x',
            label: `${fmtAddr(d.args.account)} withdrew ${fmtUsdc(d.args.amount)} USDC`,
          })
        }

        all.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1))
        setEntries(all)
      } catch {
        // silently ignore RPC errors for history
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [potId, client])

  if (loading) {
    return (
      <p className="text-sm" style={{ color: 'var(--subtle)' }}>
        Loading history…
      </p>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--subtle)' }}>
        No events yet.
      </p>
    )
  }

  const dot: Record<string, string> = {
    RoundClosed: 'var(--success)',
    RoundCancelled: 'var(--danger)',
    Withdrawn: 'var(--accent-hover)',
  }

  return (
    <ul className="space-y-2">
      {entries.map((e, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-xl px-3 py-2.5"
          style={{ background: 'var(--surface-muted)' }}
        >
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full"
            style={{ background: dot[e.type] }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
              {e.label}
            </p>
            {e.txHash && e.txHash !== '0x' && (
              <a
                href={explorerTx(e.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-xs"
                style={{ color: 'var(--subtle)' }}
              >
                {fmtAddr(e.txHash)} <ExternalLink className="size-2.5" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
