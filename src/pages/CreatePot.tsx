import { useState } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { parseUnits, decodeEventLog } from 'viem'
import { Plus, Trash2, ChevronLeft, Info } from 'lucide-react'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { useActiveChainConfig, arcTestnet, arcMainnet } from '@/lib/chain'
import { fmtUsdc } from '@/lib/format'
import { useTxWatcher } from '@/hooks/useTxWatcher'
import { useI18n } from '@/i18n'
import TxButton from '@/components/TxButton'
import ExplorerLink from '@/components/ExplorerLink'
import { toast } from 'sonner'

interface CreatePotProps {
  onBack: () => void
  onCreated?: (potId: bigint) => void
}

export default function CreatePot({ onBack, onCreated }: CreatePotProps) {
  const { address, chainId } = useAccount()
  const { turnpotAddress, chainId: activeChainId, isDeployed } = useActiveChainConfig()
  const { t } = useI18n()
  const wrongChain = chainId !== arcTestnet.id && chainId !== arcMainnet.id

  const [members, setMembers] = useState<string[]>([address ?? ''])
  const [contribution, setContribution] = useState('')
  const [durationSeconds, setDurationSeconds] = useState<number>(120)

  const DURATION_PRESETS = [
    { label: t('create.duration.demo'),   seconds: 120 },
    { label: t('create.duration.1day'),   seconds: 86400 },
    { label: t('create.duration.1week'),  seconds: 604800 },
    { label: t('create.duration.1month'), seconds: 2592000 },
  ]

  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isConfirming, isSuccess, isTimeout } = useTxWatcher(hash, {
    onSuccess: (receipt) => {
      toast.success(t('toast.potCreated'))
      // Parse PotCreated event to get the new pot ID, then navigate after 600ms
      try {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: TURNPOT_ABI, ...log })
            if (decoded.eventName === 'PotCreated') {
              const potId = (decoded.args as { potId: bigint }).potId
              setTimeout(() => onCreated?.(potId), 600)
              return
            }
          } catch { /* not this event */ }
        }
      } catch { /* fallback: no navigation */ }
    },
    onTimeout: () => { toast.warning(t('toast.txTimeout')) },
    onRevert:  () => { toast.error(t('toast.txReverted')) },
  })

  const validMembers = members.filter((m) => m.trim().length > 0)
  const hasDuplicates = new Set(validMembers.map((m) => m.toLowerCase())).size < validMembers.length
  const hasZeroAddr = validMembers.some((m) => m === '0x0000000000000000000000000000000000000000')
  const memberCountOk = validMembers.length >= 2 && validMembers.length <= 10
  const contribNum = parseFloat(contribution)
  const contribOk = !isNaN(contribNum) && contribNum > 0 && contribNum <= 1

  const canSubmit = !wrongChain && isDeployed && memberCountOk && !hasDuplicates && !hasZeroAddr && contribOk

  const contribWei = contribOk ? parseUnits(contribution, 18) : 0n
  const totalPot = contribWei * BigInt(validMembers.length)

  function addMember() {
    if (members.length < 10) setMembers([...members, ''])
  }
  function removeMember(i: number) {
    setMembers(members.filter((_, idx) => idx !== i))
  }
  function updateMember(i: number, val: string) {
    const next = [...members]; next[i] = val; setMembers(next)
  }

  function handleCreate() {
    if (wrongChain || !isDeployed) return
    writeContract(
      {
        address: turnpotAddress as `0x${string}`,
        abi: TURNPOT_ABI,
        functionName: 'createPot',
        args: [validMembers as `0x${string}`[], parseUnits(contribution, 18), BigInt(durationSeconds)],
        chainId: activeChainId,
      },
      {
        onError: (err) => {
          const msg = err.message
          if (msg.includes('CreatorNotMember'))    toast.error(t('error.creatorNotMember'))
          else if (msg.includes('InvalidMembers')) toast.error(t('error.invalidMembers'))
          else if (msg.includes('InvalidContribution')) toast.error(t('error.invalidContribution'))
          else if (msg.includes('InvalidDuration'))    toast.error(t('error.invalidDuration'))
          else if (msg.includes('user rejected')) { /* silent */ }
          else toast.error(t('error.txFailed'))
          reset()
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" style={{ color: 'var(--ink)' }} />
        </button>
        <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>
          {t('create.title')}
        </h1>
      </div>

      {/* Members */}
      <div
        className="rounded-3xl p-5 flex flex-col gap-3"
        style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {t('create.members.title', { n: validMembers.length })}
          </h2>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {t('create.members.order')}
          </span>
        </div>

        {members.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: 'var(--selected-bg)', color: 'var(--selected-text)' }}
            >
              {i + 1}
            </div>
            <input
              type="text"
              value={m}
              onChange={(e) => updateMember(i, e.target.value)}
              placeholder="0x…"
              className="mono min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
            {i === 0 ? (
              <span className="text-xs font-medium px-2" style={{ color: 'var(--muted)' }}>
                {t('create.members.you')}
              </span>
            ) : (
              <button
                onClick={() => removeMember(i)}
                className="flex size-8 items-center justify-center rounded-lg transition-all hover:bg-red-50 dark:hover:bg-red-900/30"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}

        {hasDuplicates && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>{t('create.members.dupError')}</p>
        )}
        {!memberCountOk && validMembers.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>{t('create.members.countError')}</p>
        )}

        {members.length < 10 && (
          <button
            onClick={addMember}
            className="flex items-center gap-1.5 rounded-xl py-2 text-sm font-medium transition-all hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--accent-hover)' }}
          >
            <Plus className="size-4" />
            {t('create.members.addMember')}
          </button>
        )}
      </div>

      {/* Contribution */}
      <div
        className="rounded-3xl p-5"
        style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {t('create.contribution.title')}
        </h2>
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
        {!contribOk && contribution !== '' ? (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--danger)' }}>{t('create.contribution.error')}</p>
        ) : (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--subtle)' }}>{t('create.contribution.helper')}</p>
        )}
        {contribOk && memberCountOk && (
          <div
            className="mt-3 flex items-center justify-between rounded-xl px-3 py-2"
            style={{ background: 'var(--overlay-preview)' }}
          >
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('create.contribution.totalLabel')}</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
              {fmtUsdc(totalPot)} USDC
            </span>
          </div>
        )}
      </div>

      {/* Duration */}
      <div
        className="rounded-3xl p-5"
        style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {t('create.duration.title')}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {DURATION_PRESETS.map((p) => (
            <button
              key={p.seconds}
              onClick={() => setDurationSeconds(p.seconds)}
              className="rounded-xl py-2.5 text-sm font-medium transition-all hover:scale-[1.01]"
              style={{
                background: durationSeconds === p.seconds ? 'var(--selected-bg)' : 'var(--surface-muted)',
                color: durationSeconds === p.seconds ? 'var(--selected-text)' : 'var(--ink-2)',
                border: `1px solid ${durationSeconds === p.seconds ? 'transparent' : 'var(--border)'}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div
          className="mt-3 flex items-start gap-1.5 rounded-xl px-3 py-2.5"
          style={{ background: 'var(--overlay-info)' }}
        >
          <Info className="mt-0.5 size-3.5 shrink-0" style={{ color: 'var(--subtle)' }} />
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>{t('create.duration.info')}</p>
        </div>
      </div>

      {/* Not-deployed notice */}
      {!isDeployed && !wrongChain && (
        <div
          className="rounded-2xl px-4 py-3 text-sm font-medium"
          style={{ background: 'rgba(39,117,202,0.07)', color: 'var(--brand)' }}
        >
          {t('create.notDeployed')}
        </div>
      )}

      <TxButton
        label={t('create.submit')}
        disabled={!canSubmit}
        isPending={isPending}
        isConfirming={isConfirming}
        onClick={handleCreate}
        className="w-full"
      />

      {isSuccess && hash && (
        <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(26,128,71,0.08)' }}>
          <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--success)' }}>
            {t('create.success')}
          </p>
          <ExplorerLink hash={hash} />
        </div>
      )}

      {isTimeout && hash && (
        <div
          className="rounded-2xl p-4 text-center"
          style={{ background: 'rgba(39,117,202,0.07)', border: '1px solid rgba(39,117,202,0.15)' }}
        >
          <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--brand)' }}>
            {t('create.timeout')}
          </p>
          <ExplorerLink hash={hash} />
        </div>
      )}
    </div>
  )
}
