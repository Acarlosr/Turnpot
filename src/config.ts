/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 *
 * Chain: controlled by VITE_CHAIN env var.
 *   VITE_CHAIN=testnet (default) → Arc Testnet
 *   VITE_CHAIN=mainnet           → Arc Mainnet
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { arcTestnet, arcMainnet } from '@/lib/chain'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

const IS_MAINNET = import.meta.env.VITE_CHAIN === 'mainnet'

// Two distinct configs to satisfy wagmi's strict transport/chains generic constraints.
// RPC URLs are passed explicitly — never rely on a bundled default that may lag migrations.
const testnetConfig = createConfig({
  chains: [arcTestnet, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
    [mainnet.id]: http(),
  },
})

const mainnetConfig = createConfig({
  chains: [arcMainnet, mainnet],
  connectors: [injected()],
  transports: {
    [arcMainnet.id]: http('https://rpc.mainnet.arc.io'),
    [mainnet.id]: http(),
  },
})

export const config = IS_MAINNET ? mainnetConfig : testnetConfig
