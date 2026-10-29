import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { ArrowRight, Users } from 'lucide-react'
import { useMyPots } from '@/hooks/useMyPots'
import { usePot } from '@/hooks/usePot'
import { fmtUsdc } from '@/lib/format'
import { useActiveChainConfig } from '@/lib/chain'
import { useI18n } from '@/i18n'
import ProtocolStats from '@/components/ProtocolStats'

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

  // Map numeric status to i18n key
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

interface HomeProps {
  onSelectPot: (id: bigint) => void
  onCreatePot: () => void
}

// ── SVG illustration ──────────────────────────────────────────────────────────
function RoscaIllustration({ size = 160 }: { size?: number }) {
  const cx = 100, cy = 100, r = 68
  const members = [
    { angle: -90, active: true },
    { angle: 0,   active: false },
    { angle: 90,  active: false },
    { angle: 180, active: false },
  ]
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true" className="mx-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--brand-light)" strokeWidth="2" strokeDasharray="6 4" />
      <circle cx={cx} cy={cy} r={18} fill="var(--brand)" opacity="0.15" />
      <circle cx={cx} cy={cy} r={13} fill="var(--brand)" opacity="0.30" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--brand)" fontFamily="Space Grotesk, sans-serif">$</text>
      {members.map(({ angle, active }, i) => {
        const rad = (angle * Math.PI) / 180
        const mx = cx + r * Math.cos(rad)
        const my = cy + r * Math.sin(rad)
        return (
          <g key={i}>
            {active && <circle cx={mx} cy={my} r={17} fill="none" stroke="var(--brand)" strokeWidth="2" opacity="0.5" />}
            <circle cx={mx} cy={my} r={13} fill={active ? 'var(--brand)' : 'var(--surface-muted)'} stroke={active ? 'var(--brand)' : 'var(--border-strong)'} strokeWidth="1.5" />
            <circle cx={mx} cy={my - 4} r={4} fill={active ? '#fff' : 'var(--subtle)'} />
            <path d={`M${mx - 6},${my + 10} Q${mx},${my + 3} ${mx + 6},${my + 10}`} fill={active ? '#fff' : 'var(--subtle)'} />
            {active && <text x={mx} y={my - 18} textAnchor="middle" fontSize="9" fill="var(--brand)">★</text>}
          </g>
        )
      })}
    </svg>
  )
}

export default function Home({ onSelectPot, onCreatePot }: HomeProps) {
  const { address, isConnected } = useAccount()
  const { myPotIds, isLoading } = useMyPots(address)
  const { chainName: networkName, isDeployed } = useActiveChainConfig()
  const { t } = useI18n()

  const hasPots = myPotIds.length > 0
  const showFullHero = !isConnected || (!isLoading && !hasPots)
  const showCompactHero = isConnected && (isLoading || hasPots)

  const steps = [
    t('home.how.step1'),
    t('home.how.step2'),
    t('home.how.step3'),
  ]

  return (
    <div className="flex flex-col gap-6">

      {/* ── Full hero ── */}
      {showFullHero && (
        <>
          <div
            className="overflow-hidden rounded-3xl"
            style={{ background: 'var(--surface)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)' }}
          >
            <div className="h-1 w-full" style={{ background: 'var(--brand)' }} />
            <div className="px-6 pb-6 pt-5">
              <h1 className="display text-2xl font-bold leading-tight" style={{ color: 'var(--ink)' }}>
                {t('home.hero.title').split('\n').map((line, i) => (
                  <span key={i}>{line}{i === 0 && <br />}</span>
                ))}
              </h1>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {t('home.hero.desc', { network: networkName })}
              </p>
              <div className="my-6">
                <RoscaIllustration />
                <p className="mt-2 text-center text-xs" style={{ color: 'var(--subtle)' }}>
                  {t('home.hero.recipient')}
                </p>
              </div>
              {!isConnected && (
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                  {t('home.hero.cultural', { consorcio: 'consórcio', tanda: 'tanda', susu: 'susu', network: networkName })}
                </p>
              )}
            </div>
          </div>

          {/* How it works */}
          <div
            className="rounded-3xl p-5"
            style={{ background: 'var(--surface)', backdropFilter: 'blur(20px)', border: '1px solid var(--border)' }}
          >
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              {t('home.how.title')}
            </h2>
            <div className="flex flex-col gap-3">
              {steps.map((text, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--brand)' }}
                  >
                    {i + 1}
                  </div>
                  <p className="pt-0.5 text-sm leading-snug" style={{ color: 'var(--ink-2)' }}>{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          {!isConnected ? (
            <ConnectKitButton.Custom>
              {({ show }) => (
                <button
                  onClick={show}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ background: 'var(--brand)' }}
                >
                  {t('home.cta.connect')}
                  <ArrowRight className="size-4" />
                </button>
              )}
            </ConnectKitButton.Custom>
          ) : isDeployed ? (
            <button
              onClick={onCreatePot}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: 'var(--selected-bg)', color: 'var(--selected-text)' }}
            >
              {t('home.cta.create')}
              <ArrowRight className="size-4" />
            </button>
          ) : null}
        </>
      )}

      {/* ── Compact hero ── */}
      {showCompactHero && (
        <div
          className="overflow-hidden rounded-3xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="h-1 w-full" style={{ background: 'var(--brand)' }} />
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="shrink-0">
              <RoscaIllustration size={80} />
            </div>
            <div className="min-w-0">
              <h1 className="display text-lg font-bold leading-tight" style={{ color: 'var(--ink)' }}>
                {t('home.hero.title').split('\n').map((line, i) => (
                  <span key={i}>{line}{i === 0 && <br />}</span>
                ))}
              </h1>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {t('home.hero.descCompact', { network: networkName })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create pot button (compact state) */}
      {showCompactHero && isDeployed && (
        <button
          onClick={onCreatePot}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: 'var(--selected-bg)', color: 'var(--selected-text)' }}
        >
          {t('home.cta.create')}
          <ArrowRight className="size-4" />
        </button>
      )}

      {/* Protocol stats — always visible when deployed */}
      <ProtocolStats />

      {/* My Pots */}
      {isConnected && hasPots && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            {t('home.myPots')}
          </h2>
          {isLoading ? (
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>{t('home.scanning')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {myPotIds.map((id) => (
                <PotRow key={String(id)} potId={id} onSelect={onSelectPot} address={address!} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
