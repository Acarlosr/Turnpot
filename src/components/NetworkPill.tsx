/**
 * NetworkPill — discreet network indicator in the header.
 *
 * Desktop: colored dot + short label ("Mainnet" / "Testnet" / "Wrong network")
 * Mobile:  colored dot only
 * Tooltip: "Test USDC only, no real funds" shown on Testnet pill
 * Click:   opens a small dropdown to switch between Arc chains
 */
import { useState, useRef, useEffect } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { Check, ChevronDown } from 'lucide-react'
import { arcTestnet, arcMainnet, CHAIN_CONFIGS } from '@/lib/chain'

const NETWORKS = [
  { id: arcMainnet.id, label: 'Arc Mainnet' },
  { id: arcTestnet.id, label: 'Arc Testnet' },
]

type DotColor = 'green' | 'amber' | 'red'

const DOT_STYLE: Record<DotColor, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
}

export default function NetworkPill() {
  const { chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!isConnected) return null

  const isMainnet = chainId === arcMainnet.id
  const isTestnet = chainId === arcTestnet.id
  const isKnown   = isMainnet || isTestnet

  const dotColor: DotColor = isMainnet ? 'green' : isTestnet ? 'amber' : 'red'
  const label = isMainnet ? 'Mainnet' : isTestnet ? 'Testnet' : 'Wrong network'
  const tooltip = isTestnet ? 'Test USDC only, no real funds' : undefined

  function handleSwitch(toChainId: number) {
    setOpen(false)
    const cfg = CHAIN_CONFIGS[toChainId]
    if (!cfg) return
    switchChain(
      { chainId: toChainId },
      {
        onError: () => {
          if (typeof window !== 'undefined' && window.ethereum) {
            void (window.ethereum as { request: (args: unknown) => Promise<unknown> }).request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${toChainId.toString(16)}`,
                chainName: cfg.chainName,
                nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 18 },
                rpcUrls: [cfg.rpcUrl],
                blockExplorerUrls: [cfg.explorerBase],
              }],
            })
          }
        },
      },
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={tooltip}
        aria-label={`Network: ${label}${tooltip ? ` — ${tooltip}` : ''}`}
        className="flex h-8 items-center gap-1.5 rounded-full border px-2 text-xs font-medium transition-opacity hover:opacity-70"
        style={{
          background: 'transparent',
          borderColor: 'var(--border-strong)',
          color: 'var(--ink-2)',
        }}
      >
        {/* Colored status dot */}
        <span className={`size-2 rounded-full shrink-0 ${DOT_STYLE[dotColor]}`} />

        {/* Label — hidden on very small screens, visible on sm+ */}
        <span className="hidden sm:inline">{label}</span>

        <ChevronDown
          className="size-3 shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-2xl py-1.5 shadow-xl"
          style={{
            background: 'var(--surface-strong)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <p
            className="px-4 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--subtle)' }}
          >
            Switch network
          </p>

          {NETWORKS.map((n) => {
            const active = chainId === n.id
            const nDot: DotColor = n.id === arcMainnet.id ? 'green' : 'amber'
            return (
              <button
                key={n.id}
                onClick={() => handleSwitch(n.id)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: active ? 'var(--brand)' : 'var(--ink-2)' }}
              >
                <span className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${DOT_STYLE[nDot]}`} />
                  <span className={active ? 'font-semibold' : ''}>{n.label}</span>
                </span>
                {active && <Check className="size-3.5" style={{ color: 'var(--brand)' }} />}
              </button>
            )
          })}

          {!isKnown && (
            <p
              className="px-4 py-2 text-xs"
              style={{ color: 'var(--danger)', borderTop: '1px solid var(--border)' }}
            >
              Unknown chain — please switch
            </p>
          )}
        </div>
      )}
    </div>
  )
}
