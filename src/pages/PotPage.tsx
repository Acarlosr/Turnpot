import { useEffect, useState, useCallback } from 'react'
import {
  useAccount,
  useWriteContract,
} from 'wagmi'
import { useTxWatcher } from '@/hooks/useTxWatcher'
import { ChevronLeft, Crown, Check, X, AlertTriangle, RefreshCw, Link2, ArrowLeft } from 'lucide-react'
import {
  usePot,
  useRoundDeadline,
  usePaidCount,
  useRoundPayments,
  useMembersDefaults,
} from '@/hooks/usePot'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { useActiveChainConfig } from '@/lib/chain'
import { fmtUsdc } from '@/lib/format'
import { getShareBase } from '@/lib/share'
import TxButton from '@/components/TxButton'
import ExplorerLink from '@/components/ExplorerLink'
import Countdown from '@/components/Countdown'
import PotHistory from '@/components/PotHistory'
import WalletPanel from '@/components/WalletPanel'
import AddressChip from '@/components/AddressChip'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'

interface PotPageProps {
  potId: bigint
  onBack: () => void
}

export default function PotPage({ potId, onBack }: PotPageProps) {
  const { address } = useAccount()
  const { turnpotAddress, chainId: activeChainId } = useActiveChainConfig()
  const { t } = useI18n()

  const { data: potData, refetch: refetchPot } = usePot(potId)
  const { data: deadline, refetch: refetchDeadline } = useRoundDeadline(potId)
  const { data: paidCountData, refetch: refetchPaidCount } = usePaidCount(potId)

  const members = (potData?.[0] ?? [])
  const contribution = potData?.[1] ?? 0n
  const currentRound = potData?.[3] ?? 0n
  const _roundStart = potData?.[4] ?? 0n
  void _roundStart
  const status = Number(potData?.[5] ?? 0)
  const totalRounds = members.length

  const isMember = address
    ? members.some((m) => m.toLowerCase() === address.toLowerCase())
    : false

  const { data: paymentsData, refetch: refetchPayments } = useRoundPayments(
    potId,
    currentRound,
    members,
  )
  const { data: defaultsData } = useMembersDefaults(members)

  const myMemberIndex = address
    ? members.findIndex((m) => m.toLowerCase() === address.toLowerCase())
    : -1
  const myHasPaid =
    myMemberIndex >= 0 ? ((paymentsData?.[myMemberIndex]?.result) ?? false) : false

  const paidCount = Number(paidCountData ?? 0n)
  const allPaid = paidCount === totalRounds && totalRounds > 0
  const deadlineSec = Number(deadline ?? 0n)
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  const isExpired = deadlineSec > 0 && deadlineSec < nowSec
  const isActive = status === 0

  // ── Invite link copy ──────────────────────────────────────────────────────
  const [inviteCopied, setInviteCopied] = useState(false)
  async function copyInvite() {
    const base = await getShareBase()
    const url = `${base}/pot/${potId}`
    await navigator.clipboard.writeText(url)
    setInviteCopied(true)
    toast.success(t('pot.inviteCopied'))
    setTimeout(() => setInviteCopied(false), 2500)
  }

  // ── Manual refresh ────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([refetchPot(), refetchPayments(), refetchPaidCount(), refetchDeadline()])
    setRefreshing(false)
  }, [refetchPot, refetchPayments, refetchPaidCount, refetchDeadline])

  // ── Contribute ────────────────────────────────────────────────────────────
  const { writeContract: writeContribute, data: contributeHash, isPending: contributePending, reset: resetContribute } = useWriteContract()
  const { isConfirming: contributeConfirming, isSuccess: contributeSuccess, isTimeout: contributeTimeout } =
    useTxWatcher(contributeHash, {
      onTimeout: () => { toast.warning(t('toast.contributeTimeout')) },
      onRevert:  () => { toast.error(t('toast.contributeReverted')) },
    })

  // ── Close round ───────────────────────────────────────────────────────────
  const { writeContract: writeClose, data: closeHash, isPending: closePending, reset: resetClose } = useWriteContract()
  const { isConfirming: closeConfirming, isSuccess: closeSuccess, isTimeout: closeTimeout } =
    useTxWatcher(closeHash, {
      onTimeout: () => { toast.warning(t('toast.closeTimeout')) },
      onRevert:  () => { toast.error(t('toast.closeReverted')) },
    })

  // ── Cancel round ──────────────────────────────────────────────────────────
  const { writeContract: writeCancel, data: cancelHash, isPending: cancelPending, reset: resetCancel } = useWriteContract()
  const { isConfirming: cancelConfirming, isSuccess: cancelSuccess, isTimeout: cancelTimeout } =
    useTxWatcher(cancelHash, {
      onTimeout: () => { toast.warning(t('toast.cancelTimeout')) },
      onRevert:  () => { toast.error(t('toast.cancelReverted')) },
    })

  useEffect(() => {
    if (contributeSuccess) {
      void refetchPot(); void refetchPayments(); void refetchPaidCount()
      toast.success(t('toast.contributed'))
    }
  }, [contributeSuccess, refetchPot, refetchPayments, refetchPaidCount, t])

  useEffect(() => {
    if (closeSuccess) {
      void refetchPot(); void refetchPayments(); void refetchPaidCount(); void refetchDeadline()
      toast.success(t('toast.roundClosed'))
    }
  }, [closeSuccess, refetchPot, refetchPayments, refetchPaidCount, refetchDeadline, t])

  useEffect(() => {
    if (cancelSuccess) {
      void refetchPot()
      toast.success(t('toast.roundCancelled'))
    }
  }, [cancelSuccess, refetchPot, t])

  function handleContribute() {
    writeContribute(
      {
        address: turnpotAddress as `0x${string}`,
        abi: TURNPOT_ABI,
        functionName: 'contribute',
        args: [potId],
        value: contribution,
        chainId: activeChainId,
      },
      {
        onError: (err) => {
          const m = err.message
          if (m.includes('AlreadyPaid'))        toast.error(t('error.alreadyPaid'))
          else if (m.includes('RoundExpired'))  toast.error(t('error.roundExpired'))
          else if (m.includes('WrongAmount'))   toast.error(t('error.wrongAmount'))
          else if (!m.includes('user rejected')) toast.error(t('error.txFailed'))
          resetContribute()
        },
      },
    )
  }

  function handleClose() {
    writeClose(
      {
        address: turnpotAddress as `0x${string}`,
        abi: TURNPOT_ABI,
        functionName: 'closeRound',
        args: [potId],
        chainId: activeChainId,
      },
      {
        onError: (err) => {
          const m = err.message
          if (m.includes('NotAllPaid'))         toast.error(t('error.notAllPaid'))
          else if (!m.includes('user rejected')) toast.error(t('error.closeFailed'))
          resetClose()
        },
      },
    )
  }

  function handleCancel() {
    writeCancel(
      {
        address: turnpotAddress as `0x${string}`,
        abi: TURNPOT_ABI,
        functionName: 'cancelRound',
        args: [potId],
        chainId: activeChainId,
      },
      {
        onError: (err) => {
          const m = err.message
          if (m.includes('RoundNotOver'))       toast.error(t('error.roundNotOver'))
          else if (m.includes('AllPaid'))        toast.error(t('error.allPaid'))
          else if (!m.includes('user rejected')) toast.error(t('error.cancelFailed'))
          resetCancel()
        },
      },
    )
  }

  if (!potData) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: 'var(--subtle)' }}>{t('pot.loading')}</p>
      </div>
    )
  }

  const statusKey = status === 0 ? 'status.active' : status === 1 ? 'status.completed' : 'status.cancelled'
  const statusLabel = t(statusKey)
  const statusColor = status === 0 ? 'var(--success)' : status === 1 ? 'var(--accent-hover)' : 'var(--danger)'
  const totalPot = contribution * BigInt(totalRounds)

  // Pot is done when completed (1) or cancelled (2)
  const isDone = status === 1 || status === 2

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" style={{ color: 'var(--ink)' }} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="display truncate text-xl font-bold" style={{ color: 'var(--ink)' }}>
            Pot #{Number(potId)}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: `color-mix(in srgb, ${statusColor} 12%, transparent)`, color: statusColor }}
            >
              {statusLabel}
            </span>
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>
              {t('pot.round', { cur: Number(currentRound) + 1, total: totalRounds })}
            </span>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={() => { void handleRefresh() }}
          disabled={refreshing}
          aria-label={t('pot.refresh')}
          title={t('pot.refresh')}
          className="flex size-8 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40"
        >
          <RefreshCw
            className={`size-4 ${refreshing ? 'animate-spin' : ''}`}
            style={{ color: 'var(--subtle)' }}
          />
        </button>

        {/* Invite link button */}
        <button
          onClick={() => { void copyInvite() }}
          aria-label={t('pot.copyInvite')}
          title={t('pot.copyInvite')}
          className="flex size-8 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
        >
          {inviteCopied
            ? <Check className="size-4" style={{ color: 'var(--success)' }} />
            : <Link2 className="size-4" style={{ color: 'var(--subtle)' }} />}
        </button>
      </div>

      {/* Stats card */}
      <div
        className="rounded-3xl p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}
      >
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--divide-col)' }}>
          <div className="min-w-0 pr-3">
            <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>{t('pot.contribution')}</p>
            <p className="mt-0.5 truncate text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {fmtUsdc(contribution)}
            </p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</p>
          </div>
          <div className="min-w-0 px-3">
            <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>{t('pot.totalPot')}</p>
            <p className="mt-0.5 truncate text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {fmtUsdc(totalPot)}
            </p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</p>
          </div>
          <div className="min-w-0 pl-3">
            <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>{t('pot.deadline')}</p>
            <div className="mt-0.5 text-base font-bold" style={{ color: 'var(--ink)' }}>
              {isActive && deadlineSec > 0 ? (
                <Countdown deadline={deadlineSec} />
              ) : (
                <span style={{ color: 'var(--subtle)' }}>—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Members list */}
      <div
        className="rounded-3xl p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('pot.members')}</h2>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('pot.paid', { n: paidCount, total: totalRounds })}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {members.map((m, i) => {
            const paid = paymentsData?.[i]?.result
            const defCount = Number(defaultsData?.[i]?.result ?? 0n)
            const isRecipient = isActive && i === Number(currentRound)
            const isMe = address && m.toLowerCase() === address.toLowerCase()

            return (
              <div
                key={m}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: isRecipient ? 'var(--overlay-recipient)' : 'var(--surface-muted)',
                  border: isRecipient ? '1px solid var(--border-strong)' : '1px solid transparent',
                }}
              >
                {/* Position badge */}
                <div
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: isRecipient ? 'var(--selected-bg)' : 'var(--border)',
                    color: isRecipient ? 'var(--selected-text)' : 'var(--muted)',
                  }}
                >
                  {i + 1}
                </div>

                {/* Address + copy + explorer link */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                    <AddressChip address={m} />
                    {isMe && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
                        style={{ background: 'var(--overlay-you-badge-bg)', color: 'var(--accent-hover)' }}
                      >
                        {t('create.members.you')}
                      </span>
                    )}
                    {isRecipient && <Crown className="size-3.5" style={{ color: 'var(--accent)' }} />}
                    {defCount > 0 && (
                      <span
                        className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs"
                        style={{ background: 'rgba(186,43,76,0.1)', color: 'var(--danger)' }}
                      >
                        <AlertTriangle className="size-2.5" />
                        {defCount} default{defCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Paid status */}
                {isActive && (
                  <div
                    className="flex size-6 items-center justify-center rounded-full"
                    style={{ background: paid ? 'rgba(26,128,71,0.12)' : 'rgba(138,132,156,0.12)' }}
                  >
                    {paid
                      ? <Check className="size-3.5" style={{ color: 'var(--success)' }} />
                      : <X className="size-3.5" style={{ color: 'var(--subtle)' }} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      {isActive && (
        <div className="flex flex-col gap-3">
          {isMember && (
            <div className="flex flex-col gap-2">
              <TxButton
                label={
                  myHasPaid
                    ? t('pot.alreadyPaid', { amount: fmtUsdc(contribution) })
                    : t('pot.contribute', { amount: fmtUsdc(contribution) })
                }
                disabled={myHasPaid || isExpired}
                isPending={contributePending}
                isConfirming={contributeConfirming}
                onClick={handleContribute}
                className="w-full"
              />
              {(contributeSuccess || contributeTimeout) && contributeHash && (
                <ExplorerLink hash={contributeHash} />
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <TxButton
              label={t('pot.closeRound', { n: paidCount, total: totalRounds })}
              disabled={!allPaid}
              isPending={closePending}
              isConfirming={closeConfirming}
              onClick={handleClose}
              variant="ghost"
              className="w-full"
            />
            {(closeSuccess || closeTimeout) && closeHash && <ExplorerLink hash={closeHash} />}
          </div>

          {isExpired && !allPaid && (
            <div className="flex flex-col gap-2">
              <TxButton
                label={t('pot.cancelRound')}
                isPending={cancelPending}
                isConfirming={cancelConfirming}
                onClick={handleCancel}
                variant="danger"
                className="w-full"
              />
              {(cancelSuccess || cancelTimeout) && cancelHash && <ExplorerLink hash={cancelHash} />}
            </div>
          )}
        </div>
      )}

      {/* Back to pots button when completed / cancelled */}
      {isDone && (
        <button
          onClick={onBack}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        >
          <ArrowLeft className="size-4" />
          {t('pot.backToPots')}
        </button>
      )}

      {/* Wallet panel */}
      {address && <WalletPanel />}

      {/* History */}
      <div
        className="rounded-3xl p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {t('history.title')}
        </h2>
        <PotHistory potId={potId} />
      </div>
    </div>
  )
}
