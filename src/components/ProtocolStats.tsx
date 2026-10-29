/**
 * ProtocolStats — aggregate numbers from on-chain view calls (no getLogs).
 * Shown on Home, visible connected or disconnected.
 * Shows skeleton while loading, "—" + Retry on network failure.
 */
import { ExternalLink, RotateCcw } from 'lucide-react'
import { useProtocolStats } from '@/hooks/useProtocolStats'
import { useActiveChainConfig } from '@/lib/chain'
import { fmtUsdc } from '@/lib/format'
import { useI18n } from '@/i18n'

function StatItem({
  label,
  value,
  loading,
  failed,
  onRetry,
}: {
  label: string
  value: string
  loading: boolean
  failed: boolean
  onRetry?: () => void
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
      ) : failed ? (
        <span className="flex items-center gap-1">
          <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--subtle)' }}>—</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-0.5 text-xs"
              style={{ color: 'var(--brand)' }}
              aria-label="Retry"
            >
              <RotateCcw className="size-3" />
            </button>
          )}
        </span>
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

export interface ProtocolStatsFailed {
  failed: boolean
}

interface ProtocolStatsProps {
  onFailedChange?: (failed: boolean) => void
}

export default function ProtocolStats({ onFailedChange }: ProtocolStatsProps) {
  const { potCount, txCount, totalUsdc, loading, failed } = useProtocolStats()
  const { turnpotAddress, explorerBase, isDeployed } = useActiveChainConfig()
  const { t } = useI18n()

  // Notify parent of failure state changes (for BlockedBanner)
  if (onFailedChange) onFailedChange(failed)

  if (!isDeployed) return null

  const contractUrl = explorerBase && turnpotAddress
    ? `${explorerBase}/address/${turnpotAddress}`
    : null

  // No retry available for view-call stats — wagmi will auto-retry
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
            value={potCount.toLocaleString()}
            loading={loading}
            failed={failed}
          />
        </div>
        <div className="px-3">
          <StatItem
            label={t('stats.transactions')}
            value={txCount.toLocaleString()}
            loading={loading}
            failed={failed}
          />
        </div>
        <div className="pl-3">
          <StatItem
            label={t('stats.totalUsdc')}
            value={fmtUsdc(totalUsdc)}
            loading={loading}
            failed={failed}
          />
        </div>
      </div>
    </div>
  )
}
