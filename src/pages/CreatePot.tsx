import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { Plus, Trash2, ChevronLeft, Info } from 'lucide-react'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { TURNPOT_ADDRESS, TARGET_CHAIN_ID } from '@/lib/chain'
import { fmtUsdc } from '@/lib/format'
import TxButton from '@/components/TxButton'
import ExplorerLink from '@/components/ExplorerLink'
import { toast } from 'sonner'

const DURATION_PRESETS = [
  { label: '2 min (demo)', seconds: 120 },
  { label: '1 day', seconds: 86400 },
  { label: '1 week', seconds: 604800 },
  { label: '1 month', seconds: 2592000 },
]

interface CreatePotProps {
  onBack: () => void
  onCreated?: (potId: bigint) => void
}

export default function CreatePot({ onBack }: CreatePotProps) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = chainId !== TARGET_CHAIN_ID

  // Members — creator is always first
  const [members, setMembers] = useState<string[]>([address ?? ''])
  const [contribution, setContribution] = useState('')
  const [durationSeconds, setDurationSeconds] = useState<number>(DURATION_PRESETS[0].seconds)

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    chainId: TARGET_CHAIN_ID,
  })

  // Validation
  const validMembers = members.filter((m) => m.trim().length > 0)
  const hasDuplicates =
    new Set(validMembers.map((m) => m.toLowerCase())).size < validMembers.length
  const hasZeroAddr = validMembers.some((m) => m === '0x0000000000000000000000000000000000000000')
  const memberCountOk = validMembers.length >= 2 && validMembers.length <= 10
  const contribNum = parseFloat(contribution)
  const contribOk = !isNaN(contribNum) && contribNum > 0 && contribNum <= 1

  const canSubmit =
    !wrongChain &&
    memberCountOk &&
    !hasDuplicates &&
    !hasZeroAddr &&
    contribOk

  // Preview
  const contribWei = contribOk ? parseUnits(contribution, 18) : 0n
  const totalPot = contribWei * BigInt(validMembers.length)

  function addMember() {
    if (members.length < 10) setMembers([...members, ''])
  }

  function removeMember(i: number) {
    setMembers(members.filter((_, idx) => idx !== i))
  }

  function updateMember(i: number, val: string) {
    const next = [...members]
    next[i] = val
    setMembers(next)
  }

  function handleCreate() {
    if (wrongChain) {
      switchChain({ chainId: TARGET_CHAIN_ID })
      return
    }
    writeContract(
      {
        address: TURNPOT_ADDRESS,
        abi: TURNPOT_ABI,
        functionName: 'createPot',
        args: [
          validMembers as `0x${string}`[],
          parseUnits(contribution, 18),
          BigInt(durationSeconds),
        ],
        chainId: TARGET_CHAIN_ID,
      },
      {
        onSuccess: () => {
          toast.success('Pot created!')
        },
        onError: (err) => {
          const msg = err.message
          if (msg.includes('CreatorNotMember')) toast.error('You must be listed as a member')
          else if (msg.includes('InvalidMembers')) toast.error('Invalid member list')
          else if (msg.includes('InvalidContribution')) toast.error('Invalid contribution amount')
          else if (msg.includes('InvalidDuration')) toast.error('Round duration too short (min 60s)')
          else if (msg.includes('user rejected')) {/* silent */}
          else toast.error('Transaction failed')
          reset()
        },
      },
    )
  }

  // Navigate after success
  if (isSuccess) {
    // Give user a moment to see success, then go home
    setTimeout(() => onBack(), 1500)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-xl transition-all hover:bg-black/5"
        >
          <ChevronLeft className="size-5" style={{ color: 'var(--ink)' }} />
        </button>
        <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
          Create a Pot
        </h1>
      </div>

      {/* Members */}
      <div
        className="rounded-3xl p-5 flex flex-col gap-3"
        style={{
          background: 'var(--surface-strong)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            Members ({validMembers.length}/10)
          </h2>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            Payout order = list order
          </span>
        </div>

        {members.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {i + 1}
            </div>
            <input
              type="text"
              value={m}
              onChange={(e) => updateMember(i, e.target.value)}
              placeholder="0x…"
              className="mono min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                background: 'var(--surface-muted)',
                borderColor: 'var(--border)',
                color: 'var(--ink)',
              }}
            />
            {i === 0 ? (
              <span
                className="text-xs font-medium px-2"
                style={{ color: 'var(--muted)' }}
              >
                you
              </span>
            ) : (
              <button
                onClick={() => removeMember(i)}
                className="flex size-8 items-center justify-center rounded-lg transition-all hover:bg-red-50"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}

        {hasDuplicates && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            Duplicate addresses are not allowed.
          </p>
        )}
        {!memberCountOk && validMembers.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>
            Pots need between 2 and 10 members.
          </p>
        )}

        {members.length < 10 && (
          <button
            onClick={addMember}
            className="flex items-center gap-1.5 rounded-xl py-2 text-sm font-medium transition-all hover:bg-black/5"
            style={{ color: 'var(--accent-hover)' }}
          >
            <Plus className="size-4" />
            Add member
          </button>
        )}
      </div>

      {/* Contribution */}
      <div
        className="rounded-3xl p-5"
        style={{
          background: 'var(--surface-strong)',
          border: '1px solid var(--border)',
        }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Contribution per member
        </h2>
        {/* Input with inset USDC suffix */}
        <div className="relative rounded-2xl" style={{ background: 'var(--surface-muted)' }}>
          <input
            inputMode="decimal"
            value={contribution}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, '')
              if (v === '' || /^\d*\.?\d*$/.test(v)) setContribution(v)
            }}
            placeholder="0.10"
            className="display w-full rounded-2xl bg-transparent py-3 pl-4 text-3xl font-bold tabular-nums outline-none placeholder:opacity-30"
            style={{ color: 'var(--ink)', paddingRight: '4.5rem' }}
          />
          <span
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg font-medium"
            style={{ color: 'var(--subtle)' }}
          >
            USDC
          </span>
        </div>

        {/* Helper / error text */}
        {!contribOk && contribution !== '' ? (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--danger)' }}>
            Must be between 0 and 1 USDC.
          </p>
        ) : (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
            Maximum 1 USDC per member per round.
          </p>
        )}

        {/* Preview row */}
        {contribOk && memberCountOk && (
          <div
            className="mt-3 flex items-center justify-between rounded-xl px-3 py-2"
            style={{ background: 'rgba(18,45,69,0.06)' }}
          >
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              Total pot per round
            </span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: 'var(--ink)' }}
            >
              {fmtUsdc(totalPot)} USDC
            </span>
          </div>
        )}
      </div>

      {/* Duration */}
      <div
        className="rounded-3xl p-5"
        style={{
          background: 'var(--surface-strong)',
          border: '1px solid var(--border)',
        }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Round duration
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {DURATION_PRESETS.map((p) => (
            <button
              key={p.seconds}
              onClick={() => setDurationSeconds(p.seconds)}
              className="rounded-xl py-2.5 text-sm font-medium transition-all hover:scale-[1.01]"
              style={{
                background:
                  durationSeconds === p.seconds
                    ? 'var(--accent)'
                    : 'var(--surface-muted)',
                color:
                  durationSeconds === p.seconds ? '#fff' : 'var(--ink-2)',
                border: `1px solid ${durationSeconds === p.seconds ? 'transparent' : 'var(--border)'}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div
          className="mt-3 flex items-start gap-1.5 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(18,45,69,0.04)' }}
        >
          <Info className="mt-0.5 size-3.5 shrink-0" style={{ color: 'var(--subtle)' }} />
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            If not all members pay before the deadline, anyone can cancel the round.
            Payers are refunded; non-payers accumulate a default count.
          </p>
        </div>
      </div>

      {/* Wrong chain banner */}
      {wrongChain && (
        <div
          className="rounded-2xl px-4 py-3 text-sm font-medium"
          style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)' }}
        >
          Switch to Arc Testnet to create a pot.
        </div>
      )}

      <TxButton
        label={wrongChain ? 'Switch to Arc Testnet' : 'Create pot'}
        disabled={!canSubmit && !wrongChain}
        isPending={isPending}
        isConfirming={isConfirming}
        onClick={handleCreate}
        className="w-full"
      />

      {isSuccess && hash && (
        <div
          className="rounded-2xl p-4 text-center"
          style={{ background: 'rgba(26,128,71,0.08)' }}
        >
          <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--success)' }}>
            Pot created!
          </p>
          <ExplorerLink hash={hash} />
        </div>
      )}
    </div>
  )
}
