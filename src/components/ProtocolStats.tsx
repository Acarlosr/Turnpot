/**
 * ProtocolStats — aggregate numbers from TurnPot contract events.
 * Shown on Home, visible connected or disconnected.
 */
import { ExternalLink } from 'lucide-react'
import { useProtocolStats } from '@/hooks/useActivityLogs'
import { useActiveChainConfig } from '@/lib/chain'
import { fmtUsdc } from '@/lib/format'
import { useI18n } from '@/i18n'

function StatItem({
  label,
  value,
  loading,
}: {
  label: string
  value: string
  loading: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </span>
      {loading ? (
        <div
          className="mt-1 h-5 w-16 animate-pulse rounded"
          style={{ background: 'var(--border)' }}
        />
      ) : (
        <span
          className="text-lg font-bold tabular-nums"
          style={{ color: 'var(--ink)' }}
        >
          {value}
        </span>
      )}
    </div>
  )
}

export default function ProtocolStats() {
  const { stats } = useProtocolStats()
  const { turnpotAddress, explorerBase, isDeployed } = useActiveChainConfig()
  const { t } = useI18n()

  if (!isDeployed) return null

  const contractUrl = explorerBase && turnpotAddress
    ? `${explorerBase}/address/${turnpotAddress}`
    : null

  return (
    <div
      className="rounded-3xl p-5"
      style={{
        background: 'var(--surface)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--muted)' }}
        >
          {t('stats.title')}
        </h2>
        {contractUrl && (
          <a
            href={contractUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--brand)' }}
          >
            {t('stats.contract')} <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--divide-col)' }}>
        <div className="pr-3">
          <StatItem
            label={t('stats.pots')}
            value={stats.potCount.toLocaleString()}
            loading={stats.loading}
          />
        </div>
        <div className="px-3">
          <StatItem
            label={t('stats.transactions')}
            value={stats.txCount.toLocaleString()}
            loading={stats.loading}
          />
        </div>
        <div className="pl-3">
          <StatItem
            label={t('stats.totalUsdc')}
            value={`${fmtUsdc(stats.totalUsdc)}`}
            loading={stats.loading}
          />
        </div>
      </div>
    </div>
  )
}
