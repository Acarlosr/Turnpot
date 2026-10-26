import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { AlertTriangle, Rocket } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { useActiveChainConfig, arcMainnet } from '@/lib/chain'
import { fmtAddr } from '@/lib/format'
import NetworkPill from '@/components/NetworkPill'
import ThemeToggle from '@/components/ThemeToggle'
import HeaderBalance from '@/components/HeaderBalance'
import Home from '@/pages/Home'
import CreatePot from '@/pages/CreatePot'
import PotPage from '@/pages/PotPage'
import DeployPage from '@/pages/DeployPage'

// /deploy is a hidden route — only reachable by direct URL, not linked in the nav.
const IS_DEPLOY_ROUTE = typeof window !== 'undefined' && window.location.pathname === '/deploy'

type Page =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'pot'; potId: bigint }

export default function App() {
  const [page, setPage] = useState<Page>({ name: 'home' })
  const { isConnected, chainId } = useAccount()
  const { isDeployed, isKnown } = useActiveChainConfig()

  // Show a "wrong network" hint when on an unknown chain and connected
  const showWrongNetwork = isConnected && !isKnown && !IS_DEPLOY_ROUTE

  // Show "not deployed on mainnet yet" when on mainnet but no address
  const showNotDeployed = isConnected && chainId === arcMainnet.id && !isDeployed && !IS_DEPLOY_ROUTE

  return (
    <div
      className="min-h-dvh"
      style={{ background: 'var(--bg-gradient)' }}
    >
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
        {/* Left: logo + wordmark */}
        <button
          onClick={() => setPage({ name: 'home' })}
          className="flex min-w-0 shrink items-center gap-2"
        >
          <TokenUSDC variant="branded" size={22} />
          <span className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
            TurnPot
          </span>
        </button>

        {/* Right: network pill | theme toggle | balance | wallet button */}
        <div className="flex shrink-0 items-center gap-2">
          <NetworkPill />
          <ThemeToggle />
          <HeaderBalance />
          {/* ConnectKit wallet button — custom render to keep header compact */}
          <ConnectKitButton.Custom>
            {({ isConnected, show, address, ensName }) => {
              if (!isConnected) {
                return (
                  <button
                    onClick={show}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: 'var(--brand)' }}
                  >
                    Connect
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
                  aria-label="Wallet settings"
                >
                  {/* Avatar circle */}
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: 'var(--brand)' }}
                    aria-hidden="true"
                  >
                    {(address ?? '0x').slice(2, 4).toUpperCase()}
                  </span>
                  {/* Address — hidden on mobile */}
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
          <span>TurnPot runs on Arc Mainnet and Arc Testnet — please switch using the network pill.</span>
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
            TurnPot is not deployed on Arc Mainnet yet.
          </span>
          <a
            href="/deploy"
            className="rounded-lg px-3 py-1 text-xs font-semibold text-white"
            style={{ background: 'var(--brand)' }}
          >
            Deploy now
          </a>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-24 sm:px-6">
        {IS_DEPLOY_ROUTE ? (
          <DeployPage onBack={() => window.location.assign('/')} />
        ) : (
          <>
            {page.name === 'home' && (
              <Home
                onSelectPot={(id) => setPage({ name: 'pot', potId: id })}
                onCreatePot={() => setPage({ name: 'create' })}
              />
            )}
            {page.name === 'create' && (
              <CreatePot
                onBack={() => setPage({ name: 'home' })}
                onCreated={(id) => setPage({ name: 'pot', potId: id })}
              />
            )}
            {page.name === 'pot' && (
              <PotPage
                potId={page.potId}
                onBack={() => setPage({ name: 'home' })}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
