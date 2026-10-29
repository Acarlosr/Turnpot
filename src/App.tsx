import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { AlertTriangle, Rocket, Home } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { useActiveChainConfig, arcMainnet } from '@/lib/chain'
import { fmtAddr } from '@/lib/format'
import { useRouter } from '@/hooks/useRouter'
import { useI18n } from '@/i18n'
import NetworkPill from '@/components/NetworkPill'
import ThemeToggle from '@/components/ThemeToggle'
import HeaderBalance from '@/components/HeaderBalance'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import HomeView from '@/pages/Home'
import CreatePot from '@/pages/CreatePot'
import PotPage from '@/pages/PotPage'
import DeployPage from '@/pages/DeployPage'

export default function App() {
  const { route, navigate, goHome } = useRouter()
  const { isConnected, chainId } = useAccount()
  const { isDeployed, isKnown } = useActiveChainConfig()
  const { t } = useI18n()

  const isDeployRoute = route.name === 'deploy'

  // Show banners only outside the deploy page
  const showWrongNetwork = isConnected && !isKnown && !isDeployRoute
  const showNotDeployed  = isConnected && chainId === arcMainnet.id && !isDeployed && !isDeployRoute

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>

      {/* ── Top nav ── */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3"
        style={{
          background: 'var(--header-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Left: logo + wordmark (home link) + home icon */}
        <div className="flex min-w-0 shrink items-center gap-1">
          <button
            onClick={goHome}
            className="flex min-w-0 shrink items-center gap-2"
            aria-label="TurnPot — Home"
          >
            <TokenUSDC variant="branded" size={22} />
            <span className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
              TurnPot
            </span>
          </button>

          {/* Home icon button — shown when not already on home */}
          {route.name !== 'home' && (
            <button
              onClick={goHome}
              aria-label="Home"
              className="ml-1 flex size-8 items-center justify-center rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Home className="size-4" style={{ color: 'var(--ink)' }} />
            </button>
          )}
        </div>

        {/* Right: language | network pill | theme toggle | balance | wallet */}
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <NetworkPill />
          <ThemeToggle />
          <HeaderBalance />
          <ConnectKitButton.Custom>
            {({ isConnected: ck_connected, show, address, ensName }) => {
              if (!ck_connected) {
                return (
                  <button
                    onClick={show}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--brand)' }}
                  >
                    {t('header.connect')}
                  </button>
                )
              }
              const label = ensName ?? fmtAddr(address)
              return (
                <button
                  onClick={show}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{
                    background: 'transparent',
                    borderColor: 'var(--border-strong)',
                    color: 'var(--ink)',
                  }}
                  aria-label={t('header.walletLabel')}
                >
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: 'var(--brand)' }}
                    aria-hidden="true"
                  >
                    {(address ?? '0x').slice(2, 4).toUpperCase()}
                  </span>
                  <span className="mono hidden sm:inline">{label}</span>
                </button>
              )
            }}
          </ConnectKitButton.Custom>
        </div>
      </header>

      {/* ── Wrong network banner ── */}
      {showWrongNetwork && (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm"
          style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)', borderBottom: '1px solid rgba(186,43,76,0.12)' }}
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>{t('banner.wrongNetwork')}</span>
        </div>
      )}

      {/* ── Not deployed on mainnet ── */}
      {showNotDeployed && (
        <div
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 text-sm"
          style={{ background: 'rgba(39,117,202,0.07)', color: 'var(--brand)', borderBottom: '1px solid rgba(39,117,202,0.12)' }}
        >
          <span className="flex items-center gap-1.5">
            <Rocket className="size-4 shrink-0" />
            {t('banner.notDeployed')}
          </span>
          <a
            href="/deploy"
            onClick={(e) => { e.preventDefault(); navigate({ name: 'deploy' }) }}
            className="rounded-lg px-3 py-1 text-xs font-semibold text-white"
            style={{ background: 'var(--brand)' }}
          >
            {t('banner.deployNow')}
          </a>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-24 sm:px-6">
        {route.name === 'home' && (
          <HomeView
            onSelectPot={(id) => navigate({ name: 'pot', potId: id })}
            onCreatePot={() => navigate({ name: 'create' })}
          />
        )}
        {route.name === 'create' && (
          <CreatePot
            onBack={goHome}
            onCreated={(id) => navigate({ name: 'pot', potId: id })}
          />
        )}
        {route.name === 'pot' && (
          <PotPage
            potId={route.potId}
            onBack={goHome}
          />
        )}
        {route.name === 'deploy' && (
          <DeployPage onBack={goHome} />
        )}
      </main>
    </div>
  )
}
