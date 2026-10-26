import { useAccount, useWriteContract } from 'wagmi'
import { useTxWatcher } from '@/hooks/useTxWatcher'
import { Wallet } from 'lucide-react'
import { useWithdrawableBalance } from '@/hooks/usePot'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { useActiveChainConfig } from '@/lib/chain'
import { fmtUsdc } from '@/lib/format'
import TxButton from './TxButton'
import ExplorerLink from './ExplorerLink'
import { toast } from 'sonner'

export default function WalletPanel() {
  const { address } = useAccount()
  const { turnpotAddress, chainId: activeChainId } = useActiveChainConfig()
  const { data: balance, refetch } = useWithdrawableBalance(address)

  const {
    writeContract,
    data: hash,
    isPending,
    reset,
  } = useWriteContract()
  const { isConfirming, isSuccess, isTimeout } = useTxWatcher(hash, {
    onSuccess: () => {
      void refetch()
      toast.success('Withdrawn successfully')
    },
    onTimeout: () => { toast.warning('Withdraw tx submitted — check the explorer') },
    onRevert:  () => { toast.error('Withdraw transaction reverted') },
  })

  const handleWithdraw = () => {
    writeContract(
      {
        address: turnpotAddress as `0x${string}`,
        abi: TURNPOT_ABI,
        functionName: 'withdraw',
        chainId: activeChainId,
      },
      {
        onError: (err) => {
          toast.error(err.message.includes('NothingToWithdraw') ? 'Nothing to withdraw' : 'Withdrawal failed')
          reset()
        },
      },
    )
  }

  const hasBalance = balance !== undefined && balance > 0n

  return (
    <div
      className="rounded-3xl p-5"
      style={{
        background: 'var(--surface)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex size-7 items-center justify-center rounded-lg"
          style={{ background: 'var(--overlay-icon)' }}
        >
          <Wallet className="size-4" style={{ color: 'var(--accent)' }} />
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
          Withdrawable Balance
        </span>
      </div>

      <div className="mb-4 flex items-baseline gap-1.5">
        <span
          className="display text-3xl font-bold tabular-nums"
          style={{ color: 'var(--ink)' }}
        >
          {fmtUsdc(balance)}
        </span>
        <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>
          USDC
        </span>
      </div>

      <TxButton
        label="Withdraw"
        disabled={!hasBalance}
        isPending={isPending}
        isConfirming={isConfirming}
        onClick={handleWithdraw}
        className="w-full"
      />

      {(isSuccess || isTimeout) && hash && (
        <div className="mt-3">
          <ExplorerLink hash={hash} />
        </div>
      )}
    </div>
  )
}
