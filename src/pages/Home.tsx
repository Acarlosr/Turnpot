import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { ArrowRight, Users } from 'lucide-react'
import { useMyPots } from '@/hooks/useMyPots'
import { usePot } from '@/hooks/usePot'
import { fmtUsdc, fmtStatus } from '@/lib/format'
import { TARGET_CHAIN } from '@/lib/chain'

interface PotRowProps {
  potId: bigint
  onSelect: (id: bigint) => void
  address: `0x${string}`
}

function PotRow({ potId, onSelect, address }: PotRowProps) {
  const { data } = usePot(potId)
  if (!data) return null

  const [members, contribution, , currentRound, , status] = data
  const myIndex = members.findIndex(
    (m) => m.toLowerCase() === address.toLowerCase(),
  )
  const totalRounds = members.length
  const statusNum = Number(status)
  const statusLabel = fmtStatus(statusNum)
  const statusColor =
    statusNum === 0
      ? 'var(--success)'
      : statusNum === 1
        ? 'var(--accent-hover)'
        : 'var(--danger)'

  return (
    <button
      onClick={() => onSelect(potId)}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'rgba(18,45,69,0.07)' }}
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
          {members.length} members · Round {Number(currentRound) + 1}/{totalRounds}
          {myIndex >= 0 && ` · You #${myIndex + 1}`}
          <span className="sm:hidden"> · {fmtUsdc(contribution)} USDC</span>
        </p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
          {fmtUsdc(contribution)} USDC
        </p>
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>
          per member
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

// ── SVG illustration: 4 avatars around a pot ─────────────────────────────────
function RoscaIllustration() {
  // 4 members placed at 0°, 90°, 180°, 270° on a circle of r=68
  const cx = 100
  const cy = 100
  const r = 68
  const members = [
    { angle: -90, active: true },   // top — this round's turn
    { angle: 0,   active: false },
    { angle: 90,  active: false },
    { angle: 180, active: false },
  ]

  return (
    <svg
      viewBox="0 0 200 200"
      width="160"
      height="160"
      aria-hidden="true"
      className="mx-auto"
    >
      {/* Connecting ring */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke="var(--brand-light)"
        strokeWidth="2"
        strokeDasharray="6 4"
      />

      {/* Pot in the centre */}
      <circle cx={cx} cy={cy} r={18} fill="var(--brand)" opacity="0.15" />
      <circle cx={cx} cy={cy} r={13} fill="var(--brand)" opacity="0.30" />
      <text
        x={cx} y={cy + 5}
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="var(--brand)"
        fontFamily="Space Grotesk, sans-serif"
      >
        $
      </text>

      {/* Member avatars */}
      {members.map(({ angle, active }, i) => {
        const rad = (angle * Math.PI) / 180
        const mx = cx + r * Math.cos(rad)
        const my = cy + r * Math.sin(rad)
        return (
          <g key={i}>
            {/* Halo for active member */}
            {active && (
              <circle
                cx={mx} cy={my} r={17}
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2"
                opacity="0.5"
              />
            )}
            {/* Avatar circle */}
            <circle
              cx={mx} cy={my} r={13}
              fill={active ? 'var(--brand)' : 'var(--surface-muted)'}
              stroke={active ? 'var(--brand)' : 'var(--border-strong)'}
              strokeWidth="1.5"
            />
            {/* Person silhouette */}
            <circle
              cx={mx} cy={my - 4} r={4}
              fill={active ? '#fff' : 'var(--subtle)'}
            />
            <path
              d={`M${mx - 6},${my + 10} Q${mx},${my + 3} ${mx + 6},${my + 10}`}
              fill={active ? '#fff' : 'var(--subtle)'}
            />
            {/* "This round" crown indicator */}
            {active && (
              <text
                x={mx} y={my - 18}
                textAnchor="middle"
                fontSize="9"
                fill="var(--brand)"
              >
                ★
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── How-it-works steps ────────────────────────────────────────────────────────
const STEPS = [
  {
    n: '1',
    text: 'Everyone contributes the same USDC amount each round.',
  },
  {
    n: '2',
    text: 'One member takes the whole pot — in a fixed rotation.',
  },
  {
    n: '3',
    text: 'Repeat until everyone has received it once. Missed rounds are cancelled and refunded.',
  },
]

export default function Home({ onSelectPot, onCreatePot }: HomeProps) {
  const { address, isConnected } = useAccount()
  const { myPotIds, isLoading } = useMyPots(address)
  const networkName = TARGET_CHAIN.name  // "Arc Testnet" or "Arc" (mainnet)

  return (
    <div className="flex flex-col gap-6">
      {/* ── Disconnected hero ── */}
      {!isConnected && (
        <>
          {/* Hero card */}
          <div
            className="overflow-hidden rounded-3xl"
            style={{
              background: 'var(--surface)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Blue accent bar */}
            <div className="h-1 w-full" style={{ background: 'var(--brand)' }} />

            <div className="px-6 pb-6 pt-5">
              <h1
                className="display text-2xl font-bold leading-tight"
                style={{ color: 'var(--ink)' }}
              >
                Save together.<br />Take turns.
              </h1>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: 'var(--ink-2)' }}
              >
                A rotating savings circle in USDC on {networkName}: everyone
                contributes each round, one member takes the full pot — until
                everyone has received it once.
              </p>

              {/* Illustration */}
              <div className="my-6">
                <RoscaIllustration />
                <p className="mt-2 text-center text-xs" style={{ color: 'var(--subtle)' }}>
                  ★ This round's recipient
                </p>
              </div>

              {/* Cultural note */}
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                Known as <em>consórcio</em> in Brazil, <em>tanda</em> in
                Mexico, <em>susu</em> in West Africa. Powered by {networkName}.
              </p>
            </div>
          </div>

          {/* How it works */}
          <div
            className="rounded-3xl p-5"
            style={{
              background: 'var(--surface)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--border)',
            }}
          >
            <h2
              className="mb-4 text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--muted)' }}
            >
              How it works
            </h2>
            <div className="flex flex-col gap-3">
              {STEPS.map((s) => (
                <div key={s.n} className="flex items-start gap-3">
                  <div
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--brand)' }}
                  >
                    {s.n}
                  </div>
                  <p className="pt-0.5 text-sm leading-snug" style={{ color: 'var(--ink-2)' }}>
                    {s.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Connect CTA */}
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                onClick={show}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'var(--brand)' }}
              >
                Connect wallet to get started
                <ArrowRight className="size-4" />
              </button>
            )}
          </ConnectKitButton.Custom>
        </>
      )}

      {/* ── Connected: Create pot button ── */}
      {isConnected && (
        <button
          onClick={onCreatePot}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: 'var(--accent)' }}
        >
          Create a new pot
          <ArrowRight className="size-4" />
        </button>
      )}

      {/* My Pots */}
      {isConnected && (
        <div>
          <h2
            className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--muted)' }}
          >
            My Pots
          </h2>

          {isLoading ? (
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>
              Scanning pots…
            </p>
          ) : myPotIds.length === 0 ? (
            <div
              className="rounded-2xl p-4 text-center text-sm"
              style={{ background: 'var(--surface-muted)', color: 'var(--subtle)' }}
            >
              You are not a member of any pot yet.
              <br />
              Create one or ask a friend to add you.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {myPotIds.map((id) => (
                <PotRow
                  key={String(id)}
                  potId={id}
                  onSelect={onSelectPot}
                  address={address!}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
