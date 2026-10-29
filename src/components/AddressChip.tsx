/**
 * AddressChip — truncated address with a copy button and an explorer link.
 * Used in PotPage member list and WalletPanel.
 */
import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { explorerAddr } from '@/lib/chain'
import { fmtAddr } from '@/lib/format'
import { useI18n } from '@/i18n'
import { useAccount } from 'wagmi'
import { useActiveChainConfig } from '@/lib/chain'

interface AddressChipProps {
  address: string
  /** Show full address instead of truncated. Default false. */
  full?: boolean
  className?: string
}

export default function AddressChip({ address, full = false, className = '' }: AddressChipProps) {
  const { t } = useI18n()
  const { chainId } = useAccount()
  const { chainId: activeChainId } = useActiveChainConfig()
  const effectiveChainId = chainId ?? activeChainId
  const [copied, setCopied] = useState(false)

  function copy() {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const displayAddr = full ? address : fmtAddr(address)

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="mono text-sm" style={{ color: 'var(--ink)' }}>
        {displayAddr}
      </span>

      {/* Copy button */}
      <button
        onClick={copy}
        aria-label={copied ? t('addr.copied') : t('addr.copy')}
        title={copied ? t('addr.copied') : t('addr.copy')}
        className="flex size-5 items-center justify-center rounded transition-all hover:opacity-70"
      >
        {copied
          ? <Check className="size-3" style={{ color: 'var(--success)' }} />
          : <Copy className="size-3" style={{ color: 'var(--subtle)' }} />}
      </button>

      {/* Explorer link */}
      <a
        href={explorerAddr(address, effectiveChainId)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('addr.explorer')}
        title={t('addr.explorer')}
        className="flex size-5 items-center justify-center rounded transition-all hover:opacity-70"
      >
        <ExternalLink className="size-3" style={{ color: 'var(--subtle)' }} />
      </a>
    </span>
  )
}
