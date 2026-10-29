/**
 * wagmi configuration — supports both Arc Testnet and Arc Mainnet simultaneously.
 *
 * Transport strategy (ad-blocker resilience):
 *   1. When a wallet is connected, `unstable_connector` routes reads through the
 *      wallet's injected provider (MetaMask, Brave Wallet, etc.) — bypasses any
 *      direct-RPC block from Brave Shields or ad blockers.
 *   2. Falls back through a list of public RPC endpoints with retryCount 2 / 8 s timeout.
 */

import { http, fallback, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { unstable_connector } from 'wagmi'
import { registerChain } from './tracing'
import { arcTestnet, arcMainnet } from '@/lib/chain'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arcMainnet.id, arcMainnet.rpcUrls.default.http[0])

const RPC_OPTIONS = { retryCount: 2, timeout: 8_000 }

export const config = createConfig({
  chains: [arcTestnet, arcMainnet, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: fallback(
      [
        unstable_connector(injected),
        http('https://rpc.testnet.arc.io', RPC_OPTIONS),
      ],
      { retryCount: 1 },
    ),
    [arcMainnet.id]: fallback(
      [
        unstable_connector(injected),
        http('https://rpc.mainnet.arc.io',           RPC_OPTIONS),
        http('https://rpc.drpc.mainnet.arc.io',      RPC_OPTIONS),
        http('https://rpc.quicknode.mainnet.arc.io', RPC_OPTIONS),
        http('https://rpc.blockdaemon.mainnet.arc.io', RPC_OPTIONS),
      ],
      { retryCount: 1 },
    ),
    [mainnet.id]: http(),
  },
})
