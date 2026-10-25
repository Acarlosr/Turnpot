import { ExternalLink } from 'lucide-react'
import { explorerTx } from '@/lib/chain'
import { useAccount } from 'wagmi'

interface ExplorerLinkProps {
  hash: string
  label?: string
  /** If omitted, falls back to the wallet's connected chain. */
  chainId?: number
}

export default function ExplorerLink({ hash, label = 'View on explorer', chainId }: ExplorerLinkProps) {
  const { chainId: walletChainId } = useAccount()
  const resolvedChainId = chainId ?? walletChainId
  return (
    <a
      href={explorerTx(hash, resolvedChainId)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
      style={{ color: 'var(--accent-hover)' }}
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  )
}
