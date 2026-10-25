/**
 * HeaderBalance — shows in the header next to the wallet button:
 *   [native USDC balance]  [withdraw badge if > 0]
 *
 * Balance: native balance on the active Arc chain (18 dec = USDC).
 * Refreshed on every new block (wagmi watch), so it picks up post-tx changes.
 *
 * Withdraw badge: green pill "X.XX to withdraw" when the TurnPot contract
 * has a withdrawable balance for this wallet. Clicking it opens an inline
 * popover with the Withdraw button (same as WalletPanel, no page navigation).
 */
import { useState, useRef, useEffect } from 'react'
import { useAccount, useBalance, useBlockNumber, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ArrowDownToLine } from 'lucide-react'
import { useWithdrawableBalance } from '@/hooks/usePot'
import { useActiveChainConfig } from '@/lib/chain'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { fmtUsdc2, fmtUsdc } from '@/lib/format'
import TxButton from './TxButton'
import ExplorerLink from './ExplorerLink'
import { toast } from 'sonner'

// ── Native USDC balance ───────────────────────────────────────────────────────

function useNativeBalance() {
  const { address, chainId } = useAccount()
  const { data: blockNumber } = useBlockNumber({ watch: true, chainId })
  const result = useBalance({
    address,
    chainId,
    query: {
      enabled: !!address,
      // Refresh whenever the block number changes (catches post-tx updates)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
  })
  // Refetch on every new block
  useEffect(() => {
    if (blockNumber !== undefined && address) {
      void result.refetch()
    }
    // result.refetch is stable; blockNumber + address are the real deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockNumber, address])

  return result
}

// ── Withdraw popover (self-contained) ─────────────────────────────────────────

interface WithdrawPopoverProps {
  onClose: () => void
}

function WithdrawPopover({ onClose }: WithdrawPopoverProps) {
  const { address } = useAccount()
  const { turnpotAddress, chainId: activeChainId } = useActiveChainConfig()
  const { data: balance, refetch } = useWithdrawableBalance(address)

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId: activeChainId,
  })

  useEffect(() => {
    if (isSuccess && hash) {
      void refetch()
      toast.success('Withdrawn successfully')
      onClose()
    }
  }, [isSuccess, hash, refetch, onClose])

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
      {isSuccess && hash && (
        <div className="mt-2">
          <ExplorerLink hash={hash} />
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function HeaderBalance() {
  const { address, isConnected } = useAccount()
  const { data: nativeBalance } = useNativeBalance()
  const { data: withdrawable, refetch: refetchWithdrawable } = useWithdrawableBalance(address)

  // Refetch withdrawable when block changes too
  const { chainId } = useAccount()
  const { data: blockNumber } = useBlockNumber({ watch: true, chainId })
  useEffect(() => {
    if (blockNumber !== undefined && address) {
      void refetchWithdrawable()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockNumber, address])

  const [popoverOpen, setPopoverOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close popover on outside click
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

  return (
    <div className="flex items-center gap-1.5">
      {/* Native USDC balance */}
      {nativeBalance !== undefined && (
        <span
          className="tabular-nums text-sm font-semibold hidden sm:inline"
          style={{ color: 'var(--ink)' }}
        >
          {fmtUsdc2(nativeBalance.value)} USDC
        </span>
      )}

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
            <WithdrawPopover onClose={() => setPopoverOpen(false)} />
          )}
        </div>
      )}
    </div>
  )
}
