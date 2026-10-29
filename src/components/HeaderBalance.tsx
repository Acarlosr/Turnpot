/**
 * HeaderBalance — shows in the header next to the wallet button:
 *   [native USDC balance]  [withdraw badge if > 0]
 *
 * Refresh strategy (no block-number polling):
 *   - on mount
 *   - every 30 s via setInterval
 *   - immediately after a tx succeeds (caller passes onTxSuccess callback)
 *
 * States:
 *   loading  → animated skeleton pill
 *   failed   → "—" in muted colour
 *   success  → formatted balance with 2 decimals
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useAccount, useBalance, useWriteContract } from 'wagmi'
import { ArrowDownToLine } from 'lucide-react'
import { useWithdrawableBalance } from '@/hooks/usePot'
import { useActiveChainConfig } from '@/lib/chain'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { fmtUsdc2, fmtUsdc } from '@/lib/format'
import { useTxWatcher } from '@/hooks/useTxWatcher'
import TxButton from './TxButton'
import ExplorerLink from './ExplorerLink'
import { toast } from 'sonner'

const REFRESH_INTERVAL_MS = 30_000

// ── Balance hooks with 30s timer refresh ─────────────────────────────────────

function useNativeBalance() {
  const { address, chainId } = useAccount()
  const result = useBalance({
    address,
    chainId,
    query: { enabled: !!address, staleTime: REFRESH_INTERVAL_MS, refetchInterval: false },
  })
  // 30s refresh timer
  useEffect(() => {
    if (!address) return
    const id = setInterval(() => { void result.refetch() }, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId])
  return result
}

// ── Withdraw popover (self-contained) ─────────────────────────────────────────

interface WithdrawPopoverProps {
  onClose: () => void
  onSuccess: () => void
}

function WithdrawPopover({ onClose, onSuccess }: WithdrawPopoverProps) {
  const { address } = useAccount()
  const { turnpotAddress, chainId: activeChainId } = useActiveChainConfig()
  const { data: balance, refetch } = useWithdrawableBalance(address)

  const { writeContract, data: hash, isPending, reset } = useWriteContract()

  const { isConfirming, isSuccess, isTimeout } = useTxWatcher(hash, {
    onSuccess: () => {
      void refetch()
      onSuccess()
      toast.success('Withdrawn successfully')
      onClose()
    },
  })

  function handleWithdraw() {
    writeContract(
      {
        address: turnpotAddress as `0x${string}`,
        abi: TURNPOT_ABI,
        functionName: 'withdraw',
        chainId: activeChainId,
      },
      {
        onError: (err) => {
          toast.error(
            err.message.includes('NothingToWithdraw') ? 'Nothing to withdraw' : 'Withdrawal failed',
          )
          reset()
        },
      },
    )
  }

  return (
    <div
      className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl p-4 shadow-xl"
      style={{
        background: 'var(--surface-strong)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        Withdrawable balance
      </p>
      <div className="mb-3 flex items-baseline gap-1">
        <span className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
          {fmtUsdc(balance)}
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
      </div>
      <TxButton
        label="Withdraw"
        disabled={!balance || balance === 0n}
        isPending={isPending}
        isConfirming={isConfirming}
        onClick={handleWithdraw}
        className="w-full"
      />
      {(isSuccess || isTimeout) && hash && (
        <div className="mt-2">
          <ExplorerLink hash={hash} />
        </div>
      )}
    </div>
  )
}

// ── Balance display pill ──────────────────────────────────────────────────────

function BalancePill({ isLoading, isError, value }: { isLoading: boolean; isError: boolean; value: string }) {
  if (isLoading) {
    return (
      <div
        className="h-4 w-14 animate-pulse rounded hidden sm:block"
        style={{ background: 'var(--border)' }}
        aria-label="Loading balance"
      />
    )
  }
  return (
    <span
      className="tabular-nums text-sm font-semibold hidden sm:inline"
      style={{ color: isError ? 'var(--subtle)' : 'var(--ink)' }}
    >
      {isError ? '—' : value} USDC
    </span>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function HeaderBalance() {
  const { address, isConnected } = useAccount()
  const { data: nativeBalance, isLoading: balLoading, isError: balError, refetch: refetchBalance } = useNativeBalance()
  const { data: withdrawable, refetch: refetchWithdrawable } = useWithdrawableBalance(address)

  // Refresh both after a successful withdraw
  const refetchAll = useCallback(() => {
    void refetchBalance()
    void refetchWithdrawable()
  }, [refetchBalance, refetchWithdrawable])

  const [popoverOpen, setPopoverOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popoverOpen) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setPopoverOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popoverOpen])

  if (!isConnected) return null

  const hasWithdrawable = withdrawable !== undefined && withdrawable > 0n
  const balanceStr = nativeBalance ? fmtUsdc2(nativeBalance.value) : '0.00'

  return (
    <div className="flex items-center gap-1.5">
      {/* Native USDC balance — always present, skeleton/— on failure */}
      <BalancePill
        isLoading={balLoading && !nativeBalance}
        isError={balError}
        value={balanceStr}
      />

      {/* Withdraw badge + popover */}
      {hasWithdrawable && (
        <div ref={ref} className="relative">
          <button
            onClick={() => setPopoverOpen((o) => !o)}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{
              background: 'rgba(26,128,71,0.15)',
              color: 'var(--success)',
              border: '1px solid rgba(26,128,71,0.25)',
            }}
            aria-label="You have a withdrawable TurnPot balance"
          >
            <ArrowDownToLine className="size-3 shrink-0" />
            <span className="hidden sm:inline">{fmtUsdc2(withdrawable)} to withdraw</span>
          </button>

          {popoverOpen && (
            <WithdrawPopover
              onClose={() => setPopoverOpen(false)}
              onSuccess={refetchAll}
            />
          )}
        </div>
      )}
    </div>
  )
}
