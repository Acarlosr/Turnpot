import { ExternalLink } from 'lucide-react'
import { explorerTx } from '@/lib/chain'

interface ExplorerLinkProps {
  hash: string
  label?: string
}

export default function ExplorerLink({ hash, label = 'View on explorer' }: ExplorerLinkProps) {
  return (
    <a
      href={explorerTx(hash)}
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
