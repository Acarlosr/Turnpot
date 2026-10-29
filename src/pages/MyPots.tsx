import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { ArrowRight, Users, Wallet } from 'lucide-react'
import { useMyPots } from '@/hooks/useMyPots'
import { usePot } from '@/hooks/usePot'
import { fmtUsdc } from '@/lib/format'
import { useActiveChainConfig } from '@/lib/chain'
import { useI18n } from '@/i18n'
import ProtocolStats from '@/components/ProtocolStats'

// ── Pot row ───────────────────────────────────────────────────────────────────

interface PotRowProps {
  potId: bigint
  onSelect: (id: bigint) => void
  address: `0x${string}`
}

function PotRow({ potId, onSelect, address }: PotRowProps) {
  const { data } = usePot(potId)
  const { t } = useI18n()
  if (!data) return null

  const [members, contribution, , currentRound, , status] = data
  const myIndex = members.findIndex((m) => m.toLowerCase() === address.toLowerCase())
  const totalRounds = members.length
  const statusNum = Number(status)

  const statusKey = statusNum === 0 ? 'status.active' : statusNum === 1 ? 'status.completed' : 'status.cancelled'
  const statusLabel = t(statusKey)
  const statusColor =
    statusNum === 0 ? 'var(--success)' : statusNum === 1 ? 'var(--accent-hover)' : 'var(--danger)'

  return (
    <button
      onClick={() => onSelect(potId)}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(16px)' }}
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--overlay-icon)' }}
      >
        <Users className="size-5" style={{ color: 'var(--accent)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: 'var(--ink)' }}>
            Pot #{Number(potId)}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              background: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
              color: statusColor,
            }}
          >
            {statusLabel}
          </span>
        </div>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
          {t('home.pot.members', { n: members.length })} · {t('home.pot.round', { cur: Number(currentRound) + 1, total: totalRounds })}
          {myIndex >= 0 && ` · ${t('home.pot.you', { n: myIndex + 1 })}`}
          <span className="sm:hidden"> · {fmtUsdc(contribution)} USDC</span>
        </p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
          {fmtUsdc(contribution)} USDC
        </p>
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          {t('home.pot.perMember')}
        </p>
      </div>

      <ArrowRight className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface MyPotsProps {
  onSelectPot: (id: bigint) => void
  onCreatePot: () => void
}

export default function MyPots({ onSelectPot, onCreatePot }: MyPotsProps) {
  const { address, isConnected } = useAccount()
  const { myPotIds, isLoading } = useMyPots(address)
  const { isDeployed } = useActiveChainConfig()
  const { t } = useI18n()

  // Show newest first
  const sortedIds = [...myPotIds].reverse()

  return (
    <div className="flex flex-col gap-6">

      {/* Protocol stats — always at the top */}
      <ProtocolStats />

      {/* Pots list or connect prompt */}
      {!isConnected ? (
        /* Not connected */
        <div
          className="flex flex-col items-center gap-5 rounded-3xl p-8 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div
            className="flex size-14 items-center justify-center rounded-2xl"
            style={{ background: 'var(--overlay-icon)' }}
          >
            <Wallet className="size-7" style={{ color: 'var(--accent)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
            {t('mypots.connectPrompt')}
          </p>
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                onClick={show}
                className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'var(--brand)' }}
              >
                {t('home.cta.connect')}
                <ArrowRight className="size-4" />
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      ) : (
        /* Connected — pots list */
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              {t('home.myPots')}
            </h2>
            {isDeployed && (
              <button
                onClick={onCreatePot}
                className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80"
                style={{ background: 'var(--brand)' }}
              >
                + {t('home.cta.create')}
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl"
                  style={{ background: 'var(--border)' }}
                />
              ))}
            </div>
          ) : sortedIds.length === 0 ? (
            <div
              className="rounded-2xl px-4 py-8 text-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--subtle)' }}>
                {t('home.scanning')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedIds.map((id) => (
                <PotRow key={String(id)} potId={id} onSelect={onSelectPot} address={address!} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
