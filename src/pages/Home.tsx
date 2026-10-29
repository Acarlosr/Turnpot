import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { ArrowRight, List } from 'lucide-react'
import { useActiveChainConfig } from '@/lib/chain'
import { useI18n } from '@/i18n'

interface HomeProps {
  onCreatePot: () => void
  onMyPots: () => void
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

export default function Home({ onCreatePot, onMyPots }: HomeProps) {
  const { isConnected } = useAccount()
  const { chainName: networkName, isDeployed } = useActiveChainConfig()
  const { t } = useI18n()

  const steps = [
    t('home.how.step1'),
    t('home.how.step2'),
    t('home.how.step3'),
  ]

  return (
    <div className="flex flex-col gap-6">

      {/* ── Hero card — always full ── */}
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
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            {t('home.hero.cultural', { consorcio: 'consórcio', tanda: 'tanda', susu: 'susu', network: networkName })}
          </p>
        </div>
      </div>

      {/* ── How it works ── */}
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

      {/* ── CTAs ── */}
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
        <div className="flex flex-col gap-3">
          <button
            onClick={onCreatePot}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'var(--brand)' }}
          >
            {t('home.cta.create')}
            <ArrowRight className="size-4" />
          </button>
          <button
            onClick={onMyPots}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--ink)', background: 'transparent' }}
          >
            <List className="size-4" />
            {t('home.cta.myPots')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
