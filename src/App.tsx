import { useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { AlertTriangle } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { TARGET_CHAIN_ID } from '@/lib/chain'
import Home from '@/pages/Home'
import CreatePot from '@/pages/CreatePot'
import PotPage from '@/pages/PotPage'

type Page =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'pot'; potId: bigint }

export default function App() {
  const [page, setPage] = useState<Page>({ name: 'home' })
  const { isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = isConnected && chainId !== TARGET_CHAIN_ID

  return (
    <div
      className="min-h-dvh"
      style={{ background: 'var(--bg-gradient)' }}
    >
      {/* Top nav */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => setPage({ name: 'home' })}
          className="flex min-w-0 shrink items-center gap-2"
        >
          <TokenUSDC variant="branded" size={22} />
          <span className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
            TurnPot
          </span>
        </button>
        <ConnectKitButton />
      </header>

      {/* Wrong-chain banner */}
      {wrongChain && (
        <div
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5 text-sm"
          style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)' }}
        >
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-4" />
            Switch to Arc Testnet to use TurnPot
          </span>
          <button
            onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
            className="rounded-lg px-3 py-1 text-xs font-semibold"
            style={{ background: 'var(--danger)', color: '#fff' }}
          >
            Switch
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-24 sm:px-6">
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
      </main>
    </div>
  )
}
