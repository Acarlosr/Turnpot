/**
 * WalletDrawer — slides in from the right when the wallet chip is clicked.
 *
 * Sections:
 *  1. Address (copy + explorer link), USDC balance, withdrawable balance + Withdraw btn
 *  2. My activity — wallet's TurnPot transactions, newest first
 *  3. Disconnect button
 */
import { useEffect, useRef, useState } from 'react'
import { useAccount, useBalance, useDisconnect, useWriteContract } from 'wagmi'
import { Copy, Check, ExternalLink, X, ArrowDownToLine } from 'lucide-react'
import { useWithdrawableBalance } from '@/hooks/usePot'
import { useWalletActivity } from '@/hooks/useActivityLogs'
import { type ActivityRow } from '@/hooks/useActivityLogs'
import { useActiveChainConfig, explorerAddr, explorerTx } from '@/lib/chain'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { fmtUsdc, fmtUsdc2, fmtAddr } from '@/lib/format'
import { useTxWatcher } from '@/hooks/useTxWatcher'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'

// ── helpers ───────────────────────────────────────────────────────────────────

function relTime(blockNumber: bigint): string {
  // Block numbers on Arc: ~1 s finality. Approximate age from block delta is
  // unreliable without timestamps; show block number instead.
  if (blockNumber === 0n) return ''
  return `block ${blockNumber.toLocaleString()}`
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()
  return (
    <button
      aria-label={t('addr.copy')}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
    >
      {copied
        ? <Check className="size-3.5" style={{ color: 'var(--success)' }} />
        : <Copy className="size-3.5" style={{ color: 'var(--subtle)' }} />}
    </button>
  )
}

// ── Activity row ──────────────────────────────────────────────────────────────

function ActivityItem({ row, chainId }: { row: ActivityRow; chainId: number | undefined }) {
  const { t } = useI18n()
  const idStr = row.potId !== null ? String(row.potId) : ''

  const label =
    row.type === 'Contributed'   ? t('drawer.contributed', { id: idStr }) :
    row.type === 'ReceivedPot'   ? t('drawer.receivedPot',  { id: idStr }) :
    row.type === 'RefundCredited'? t('drawer.refund',       { id: idStr }) :
                                   t('drawer.withdrawn')

  const amountColor =
    row.type === 'ReceivedPot' ? 'var(--success)' :
    row.type === 'Withdrawn'   ? 'var(--danger)'  : 'var(--ink)'

  const sign =
    row.type === 'ReceivedPot' ? '+' :
    row.type === 'Withdrawn'   ? '-' : '-'

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-3 py-2.5"
      style={{ background: 'var(--surface-muted)' }}
    >
      {/* Type dot */}
      <span
        className="mt-1 size-2 shrink-0 rounded-full"
        style={{
          background:
            row.type === 'ReceivedPot'    ? 'var(--success)' :
            row.type === 'RefundCredited' ? 'var(--accent-hover)' :
            row.type === 'Withdrawn'      ? 'var(--danger)'  : 'var(--brand)',
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug" style={{ color: 'var(--ink)' }}>{label}</p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>
          {relTime(row.blockNumber)}
          {row.txHash && row.txHash !== '0x' && (
            <>
              {' · '}
              <a
                href={explorerTx(row.txHash, chainId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 underline"
              >
                {fmtAddr(row.txHash)} <ExternalLink className="size-2.5" />
              </a>
            </>
          )}
        </p>
      </div>
      {row.amount > 0n && (
        <span
          className="shrink-0 text-sm font-semibold tabular-nums"
          style={{ color: amountColor }}
        >
          {sign}{fmtUsdc(row.amount)}
        </span>
      )}
    </div>
  )
}

// ── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-muted)' }}>
      <span className="size-2 rounded-full bg-current opacity-10 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-2/3 rounded animate-pulse" style={{ background: 'var(--border)' }} />
        <div className="h-2.5 w-1/3 rounded animate-pulse" style={{ background: 'var(--border)' }} />
      </div>
      <div className="h-3 w-10 rounded animate-pulse" style={{ background: 'var(--border)' }} />
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────

interface WalletDrawerProps {
  open: boolean
  onClose: () => void
}

export default function WalletDrawer({ open, onClose }: WalletDrawerProps) {
  const { address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { t } = useI18n()
  const { turnpotAddress, chainId: activeChainId, explorerBase } = useActiveChainConfig()

  // Balances
  const { data: nativeBalance } = useBalance({ address, chainId, query: { enabled: !!address } })
  const { data: withdrawable, refetch: refetchWithdrawable } = useWithdrawableBalance(address)

  // Activity
  const { activity, loading: activityLoading } = useWalletActivity(address)

  // Withdraw
  const { writeContract, data: withdrawHash, isPending: withdrawPending, reset: resetWithdraw } = useWriteContract()
  const { isConfirming: withdrawConfirming, isSuccess: withdrawSuccess } = useTxWatcher(withdrawHash, {
    onSuccess: () => {
      void refetchWithdrawable()
      toast.success(t('drawer.toast.withdrawn'))
    },
    onTimeout: () => toast.warning(t('drawer.toast.withdrawTimeout')),
    onRevert: () => toast.error(t('drawer.toast.withdrawReverted')),
  })

  function handleWithdraw() {
    if (!turnpotAddress) return
    writeContract(
      { address: turnpotAddress, abi: TURNPOT_ABI, functionName: 'withdraw', chainId: activeChainId },
      {
        onError: (err) => {
          toast.error(err.message.includes('NothingToWithdraw') ? t('drawer.toast.nothingToWithdraw') : t('drawer.toast.withdrawFailed'))
          resetWithdraw()
        },
      },
    )
  }

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Trap scroll on body when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const drawerRef = useRef<HTMLDivElement>(null)
  const hasWithdrawable = withdrawable !== undefined && withdrawable > 0n
  const nativeUsdc = nativeBalance
    ? Number(nativeBalance.value) / 1e18
    : null

  const contractUrl = explorerBase
    ? `${explorerBase}/address/${turnpotAddress}`
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 transition-opacity"
        style={{
          background: 'rgba(0,0,0,0.35)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Wallet"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col shadow-2xl"
        style={{
          background: 'var(--surface-strong)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid var(--border)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Avatar */}
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: 'var(--brand)' }}
            >
              {(address ?? '0x').slice(2, 4).toUpperCase()}
            </span>
            <span className="mono truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {fmtAddr(address)}
            </span>
            <CopyBtn text={address ?? ''} />
            {address && chainId !== undefined && (
              <a
                href={explorerAddr(address, chainId)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('addr.explorer')}
                className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                <ExternalLink className="size-3.5" style={{ color: 'var(--subtle)' }} />
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-2 flex size-8 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="size-5" style={{ color: 'var(--ink)' }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Balances card */}
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                {t('drawer.balance')}
              </span>
              {nativeUsdc !== null && (
                <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                  {fmtUsdc2(nativeBalance!.value)} USDC
                </span>
              )}
            </div>

            {hasWithdrawable && (
              <div
                className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
                style={{ background: 'rgba(26,128,71,0.08)', border: '1px solid rgba(26,128,71,0.18)' }}
              >
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
                    {t('drawer.withdrawable')}
                  </p>
                  <p className="text-base font-bold tabular-nums" style={{ color: 'var(--success)' }}>
                    {fmtUsdc(withdrawable)} USDC
                  </p>
                </div>
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawPending || withdrawConfirming || withdrawSuccess}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--success)', flexShrink: 0 }}
                >
                  <ArrowDownToLine className="size-3.5" />
                  {withdrawPending || withdrawConfirming
                    ? '…'
                    : t('drawer.withdraw')}
                </button>
              </div>
            )}

            {/* Contract link */}
            {contractUrl && (
              <a
                href={contractUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--subtle)' }}
              >
                <ExternalLink className="size-3" />
                {t('drawer.viewContract')}
              </a>
            )}
          </div>

          {/* Activity */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              {t('drawer.activity')}
            </h3>

            {activityLoading && activity.length === 0 ? (
              <div className="space-y-2">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : activity.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--subtle)' }}>
                {t('drawer.empty')}
              </p>
            ) : (
              <div className="space-y-2">
                {activity.map((row, i) => (
                  <ActivityItem key={i} row={row} chainId={chainId} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Disconnect */}
        <div
          className="shrink-0 px-5 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={() => { disconnect(); onClose() }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all hover:opacity-80"
            style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.15)' }}
          >
            {t('drawer.disconnect')}
          </button>
        </div>
      </div>
    </>
  )
}
