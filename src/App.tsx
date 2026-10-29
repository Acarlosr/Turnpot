import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { AlertTriangle, Rocket } from 'lucide-react'
import { useActiveChainConfig, arcMainnet } from '@/lib/chain'
import TurnPotLogo from '@/components/TurnPotLogo'
import { fmtAddr } from '@/lib/format'
import { useRouter } from '@/hooks/useRouter'
import { useI18n } from '@/i18n'
import { useProtocolStats } from '@/hooks/useProtocolStats'
import NetworkPill from '@/components/NetworkPill'
import ThemeToggle from '@/components/ThemeToggle'
import HeaderBalance from '@/components/HeaderBalance'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import WalletDrawer from '@/components/WalletDrawer'
import BlockedBanner from '@/components/BlockedBanner'
import HomeView from '@/pages/Home'
import MyPotsView from '@/pages/MyPots'
import CreatePot from '@/pages/CreatePot'
import PotPage from '@/pages/PotPage'
import DeployPage from '@/pages/DeployPage'

export default function App() {
  const { route, navigate, goHome } = useRouter()
  const { isConnected, chainId } = useAccount()
  const { isDeployed, isKnown } = useActiveChainConfig()
  const { t } = useI18n()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { failed: readsFailed } = useProtocolStats()

  const isDeployRoute = route.name === 'deploy'
  const isHomeRoute   = route.name === 'home'
  const isMyPotsRoute = route.name === 'my-pots'

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
        {/* Left: logo + nav tabs */}
        <div className="flex min-w-0 shrink items-center gap-1">
          {/* Logo — always goes to "/" */}
          <button
            onClick={goHome}
            className="flex shrink-0 items-center gap-2"
            aria-label="TurnPot — Home"
          >
            <TurnPotLogo size={26} />
            <span className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
              TurnPot
            </span>
          </button>

          {/* Nav tabs — shown when connected (or always to allow navigation) */}
          {isConnected && (
            <nav className="ml-2 flex items-center gap-0.5" aria-label="Main navigation">
              <button
                onClick={goHome}
                className="rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
                style={isHomeRoute ? {
                  background: 'var(--selected-bg)',
                  color: 'var(--selected-text)',
                } : {
                  color: 'var(--subtle)',
                }}
                aria-current={isHomeRoute ? 'page' : undefined}
              >
                {t('nav.home')}
              </button>
              <button
                onClick={() => navigate({ name: 'my-pots' })}
                className="rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
                style={isMyPotsRoute ? {
                  background: 'var(--selected-bg)',
                  color: 'var(--selected-text)',
                } : {
                  color: 'var(--subtle)',
                }}
                aria-current={isMyPotsRoute ? 'page' : undefined}
              >
                {t('nav.myPots')}
              </button>
            </nav>
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
                  onClick={() => setDrawerOpen(true)}
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

          {/* Wallet activity drawer */}
          {isConnected && (
            <WalletDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          )}
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

      {/* ── Blocked reads banner ── */}
      {readsFailed && !isDeployRoute && (
        <div className="mx-auto w-full max-w-lg px-4 pt-4 sm:px-6">
          <BlockedBanner show={readsFailed} />
        </div>
      )}

      {/* ── Main content ── */}
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-24 sm:px-6">
        {route.name === 'home' && (
          <HomeView
            onCreatePot={() => navigate({ name: 'create' })}
            onMyPots={() => navigate({ name: 'my-pots' })}
          />
        )}
        {route.name === 'my-pots' && (
          <MyPotsView
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
