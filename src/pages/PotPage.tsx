import { useEffect, useState } from 'react'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { ChevronLeft, Crown, Check, X, AlertTriangle } from 'lucide-react'
import {
  usePot,
  useRoundDeadline,
  usePaidCount,
  useRoundPayments,
  useMembersDefaults,
} from '@/hooks/usePot'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { useActiveChainConfig } from '@/lib/chain'
import { fmtUsdc, fmtAddr, fmtStatus } from '@/lib/format'
import TxButton from '@/components/TxButton'
import ExplorerLink from '@/components/ExplorerLink'
import Countdown from '@/components/Countdown'
import PotHistory from '@/components/PotHistory'
import WalletPanel from '@/components/WalletPanel'
import { toast } from 'sonner'

interface PotPageProps {
  potId: bigint
  onBack: () => void
}

export default function PotPage({ potId, onBack }: PotPageProps) {
  const { address } = useAccount()
  const { turnpotAddress, chainId: activeChainId } = useActiveChainConfig()

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

  // Derive myHasPaid from the shared payments batch (no conditional hook)
  const myMemberIndex = address
    ? members.findIndex((m) => m.toLowerCase() === address.toLowerCase())
    : -1
  const myHasPaid =
    myMemberIndex >= 0
      ? ((paymentsData?.[myMemberIndex]?.result) ?? false)
      : false

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

  // --- Contribute ---
  const {
    writeContract: writeContribute,
    data: contributeHash,
    isPending: contributePending,
    reset: resetContribute,
  } = useWriteContract()
  const { isLoading: contributeConfirming, isSuccess: contributeSuccess } =
    useWaitForTransactionReceipt({ hash: contributeHash, chainId: activeChainId })

  // --- CloseRound ---
  const {
    writeContract: writeClose,
    data: closeHash,
    isPending: closePending,
    reset: resetClose,
  } = useWriteContract()
  const { isLoading: closeConfirming, isSuccess: closeSuccess } =
    useWaitForTransactionReceipt({ hash: closeHash, chainId: activeChainId })

  // --- CancelRound ---
  const {
    writeContract: writeCancel,
    data: cancelHash,
    isPending: cancelPending,
    reset: resetCancel,
  } = useWriteContract()
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } =
    useWaitForTransactionReceipt({ hash: cancelHash, chainId: activeChainId })

  // Refresh on success
  useEffect(() => {
    if (contributeSuccess) {
      void refetchPot(); void refetchPayments(); void refetchPaidCount()
      toast.success('Contribution confirmed')
    }
  }, [contributeSuccess, refetchPot, refetchPayments, refetchPaidCount])

  useEffect(() => {
    if (closeSuccess) {
      void refetchPot(); void refetchPayments(); void refetchPaidCount(); void refetchDeadline()
      toast.success('Round closed')
    }
  }, [closeSuccess, refetchPot, refetchPayments, refetchPaidCount, refetchDeadline])

  useEffect(() => {
    if (cancelSuccess) {
      void refetchPot()
      toast.success('Round cancelled — refunds credited')
    }
  }, [cancelSuccess, refetchPot])

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
          if (m.includes('AlreadyPaid')) toast.error('You already paid this round')
          else if (m.includes('RoundExpired')) toast.error('Round deadline has passed')
          else if (m.includes('WrongAmount')) toast.error('Wrong contribution amount')
          else if (!m.includes('user rejected')) toast.error('Contribution failed')
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
          if (m.includes('NotAllPaid')) toast.error('Not all members have paid yet')
          else if (!m.includes('user rejected')) toast.error('Close round failed')
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
          if (m.includes('RoundNotOver')) toast.error('Deadline has not passed yet')
          else if (m.includes('AllPaid')) toast.error('All members already paid — close instead')
          else if (!m.includes('user rejected')) toast.error('Cancel failed')
          resetCancel()
        },
      },
    )
  }

  if (!potData) {
    return (
      <div className="flex items-center justify-center py-20">
        <p style={{ color: 'var(--subtle)' }}>Loading pot…</p>
      </div>
    )
  }

  const statusLabel = fmtStatus(status)
  const statusColor =
    status === 0 ? 'var(--success)' : status === 1 ? 'var(--accent-hover)' : 'var(--danger)'
  const totalPot = contribution * BigInt(totalRounds)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
        >
          <ChevronLeft className="size-5" style={{ color: 'var(--ink)' }} />
        </button>
        <div className="min-w-0">
          <h1 className="display truncate text-xl font-bold" style={{ color: 'var(--ink)' }}>
            Pot #{Number(potId)}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
                color: statusColor,
              }}
            >
              {statusLabel}
            </span>
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>
              Round {Number(currentRound) + 1} of {totalRounds}
            </span>
          </div>
        </div>
      </div>

      {/* Stats card */}
      <div
        className="rounded-3xl p-5"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--divide-col)' }}>
          <div className="min-w-0 pr-3">
            <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>Contribution</p>
            <p className="mt-0.5 truncate text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {fmtUsdc(contribution)}
            </p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</p>
          </div>
          <div className="min-w-0 px-3">
            <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>Total pot</p>
            <p className="mt-0.5 truncate text-base font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {fmtUsdc(totalPot)}
            </p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</p>
          </div>
          <div className="min-w-0 pl-3">
            <p className="truncate text-xs" style={{ color: 'var(--muted)' }}>Deadline</p>
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
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Members
          </h2>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {paidCount}/{totalRounds} paid
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
                  background: isRecipient
                    ? 'var(--overlay-recipient)'
                    : 'var(--surface-muted)',
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

                {/* Address */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span
                      className="mono shrink-0 text-sm"
                      style={{ color: 'var(--ink)' }}
                    >
                      {fmtAddr(m)}
                    </span>
                    {isMe && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-xs font-semibold"
                        style={{
                          background: 'var(--overlay-you-badge-bg)',
                          color: 'var(--accent-hover)',
                        }}
                      >
                        you
                      </span>
                    )}
                    {isRecipient && (
                      <Crown className="size-3.5" style={{ color: 'var(--accent)' }} />
                    )}
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
                    style={{
                      background: paid
                        ? 'rgba(26,128,71,0.12)'
                        : 'rgba(138,132,156,0.12)',
                    }}
                  >
                    {paid ? (
                      <Check className="size-3.5" style={{ color: 'var(--success)' }} />
                    ) : (
                      <X className="size-3.5" style={{ color: 'var(--subtle)' }} />
                    )}
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
          {/* Contribute */}
          {isMember && (
            <div className="flex flex-col gap-2">
              <TxButton
                label={
                  myHasPaid
                    ? `Paid this round (${fmtUsdc(contribution)} USDC)`
                    : `Contribute ${fmtUsdc(contribution)} USDC`
                }
                disabled={myHasPaid || isExpired}
                isPending={contributePending}
                isConfirming={contributeConfirming}
                onClick={handleContribute}
                className="w-full"
              />
              {contributeSuccess && contributeHash && (
                <ExplorerLink hash={contributeHash} />
              )}
            </div>
          )}

          {/* Close round */}
          <div className="flex flex-col gap-2">
            <TxButton
              label={`Close round (${paidCount}/${totalRounds} paid)`}
              disabled={!allPaid}
              isPending={closePending}
              isConfirming={closeConfirming}
              onClick={handleClose}
              variant="ghost"
              className="w-full"
            />
            {closeSuccess && closeHash && <ExplorerLink hash={closeHash} />}
          </div>

          {/* Cancel round */}
          {isExpired && !allPaid && (
            <div className="flex flex-col gap-2">
              <TxButton
                label="Cancel round (deadline passed)"
                isPending={cancelPending}
                isConfirming={cancelConfirming}
                onClick={handleCancel}
                variant="danger"
                className="w-full"
              />
              {cancelSuccess && cancelHash && <ExplorerLink hash={cancelHash} />}
            </div>
          )}
        </div>
      )}

      {/* Wallet panel for withdrawable balance */}
      {address && <WalletPanel />}

      {/* History */}
      <div
        className="rounded-3xl p-5"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          History
        </h2>
        <PotHistory potId={potId} />
      </div>
    </div>
  )
}
