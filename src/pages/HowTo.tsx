/**
 * HowTo — "How to use TurnPot" guide page.
 * Five sections: wallet install, add Arc network, get USDC, round mechanics, FAQ.
 * Fully translated (en / pt-BR / es). No onchain reads.
 */
import { useState } from 'react'
import { useAccount } from 'wagmi'
import {
  Wallet, Globe, DollarSign, RotateCcw, HelpCircle,
  ChevronDown, ChevronUp, Check, Copy, ArrowLeft,
  ExternalLink, AlertTriangle, Smartphone,
} from 'lucide-react'
import { useI18n } from '@/i18n'

// ── Platform detection (run once, outside React lifecycle) ────────────────────
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
const isIOS     = /iPad|iPhone|iPod/.test(ua)
const isAndroid = /Android/.test(ua)
const isMobile  = isIOS || isAndroid

// ── Arc chain params for wallet_addEthereumChain ──────────────────────────────
const ARC_MAINNET_PARAMS = {
  chainId:          '0x13a2',        // 5042
  chainName:        'Arc Mainnet',
  nativeCurrency:   { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls:          ['https://rpc.mainnet.arc.io'],
  blockExplorerUrls:['https://explorer.arc.io'],
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({
  icon, title, children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(39,117,202,0.12)', color: 'var(--brand)' }}
        >
          {icon}
        </span>
        <h2 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>
          {title}
        </h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--subtle)' }}>
        {children}
      </div>
    </div>
  )
}

// ── Numbered step row ─────────────────────────────────────────────────────────
function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: 'var(--brand)', marginTop: '1px' }}
      >
        {n}
      </span>
      <p style={{ color: 'var(--subtle)' }}>{text}</p>
    </div>
  )
}

// ── FAQ item ──────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{ border: '1px solid var(--border)' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium transition-colors"
        style={{ color: 'var(--ink)', background: open ? 'var(--selected-bg)' : 'transparent' }}
        aria-expanded={open}
      >
        {q}
        {open
          ? <ChevronUp className="size-4 shrink-0" style={{ color: 'var(--brand)' }} />
          : <ChevronDown className="size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
        }
      </button>
      {open && (
        <p className="px-4 pb-4 pt-1 text-sm leading-relaxed" style={{ color: 'var(--subtle)' }}>
          {a}
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface HowToProps {
  onBack: () => void
}

export default function HowTo({ onBack }: HowToProps) {
  const { t } = useI18n()
  const { address, isConnected } = useAccount()

  // Section 2: Add Arc Mainnet
  const [addStatus, setAddStatus] = useState<'idle' | 'added' | 'error'>('idle')
  async function addArcMainnet() {
    try {
      const provider = (window as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
      if (!provider) { setAddStatus('error'); return }
      await provider.request({ method: 'wallet_addEthereumChain', params: [ARC_MAINNET_PARAMS] })
      setAddStatus('added')
    } catch {
      setAddStatus('error')
    }
  }

  // Section 3: Copy address
  const [copied, setCopied] = useState(false)
  async function copyAddress() {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: 'var(--subtle)' }}
      >
        <ArrowLeft className="size-4" />
        {t('howto.back')}
      </button>

      <h1 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>
        {t('howto.title')}
      </h1>

      {/* ── Section 1: Install a wallet ── */}
      <Section icon={<Wallet className="size-4" />} title={t('howto.s1.title')}>
        <p>{t('howto.s1.body')}</p>
        <p className="font-medium" style={{ color: 'var(--ink)' }}>{t('howto.s1.metamask')}</p>

        {/* Store buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* App Store — iOS or desktop */}
          {(!isMobile || isIOS) && (
            <a
              href="https://apps.apple.com/br/app/metamask-trade-crypto/id1438144202"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            >
              <Smartphone className="size-3.5 shrink-0" style={{ color: 'var(--brand)' }} />
              {t('howto.s1.appStore')}
              <ExternalLink className="size-3 shrink-0 opacity-50" />
            </a>
          )}
          {/* Google Play — Android or desktop */}
          {(!isMobile || isAndroid) && (
            <a
              href="https://play.google.com/store/apps/details?id=io.metamask&hl=pt_BR"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            >
              <Smartphone className="size-3.5 shrink-0" style={{ color: '#34a853' }} />
              {t('howto.s1.googlePlay')}
              <ExternalLink className="size-3 shrink-0 opacity-50" />
            </a>
          )}
          {/* Browser extension — desktop only */}
          {!isMobile && (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(39,117,202,0.10)', border: '1px solid rgba(39,117,202,0.2)', color: 'var(--brand)' }}
            >
              <Globe className="size-3.5 shrink-0" />
              {t('howto.s1.extension')}
              <ExternalLink className="size-3 shrink-0 opacity-60" />
            </a>
          )}
        </div>

        {/* Fake-wallet warning */}
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-medium"
          style={{ background: 'rgba(245,158,11,0.08)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span><strong>{t('howto.s1.fakeWarning')}</strong></span>
        </div>

        {/* Getting-started steps */}
        <p className="font-medium" style={{ color: 'var(--ink)' }}>{t('howto.s1.setup')}</p>
        <div className="space-y-2 pt-1">
          <Step n={1} text={t('howto.s1.step1')} />
          <Step n={2} text={t('howto.s1.step2')} />
          <Step n={3} text={t('howto.s1.step3')} />
        </div>

        {/* Recovery phrase warning */}
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-medium"
          style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.12)' }}
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>{t('howto.s1.phrase')}</span>
        </div>
      </Section>

      {/* ── Section 2: Add Arc network ── */}
      <Section icon={<Globe className="size-4" />} title={t('howto.s2.title')}>
        <p>{t('howto.s2.body')}</p>
        <button
          onClick={() => { void addArcMainnet() }}
          className="mt-1 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
          style={{ background: 'var(--brand)' }}
        >
          <Globe className="size-4" />
          {t('howto.s2.button')}
        </button>
        {addStatus === 'added' && (
          <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--success)' }}>
            <Check className="size-3.5" /> {t('howto.s2.added')}
          </p>
        )}
        {addStatus === 'error' && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>{t('howto.s2.error')}</p>
        )}
      </Section>

      {/* ── Section 3: Get USDC ── */}
      <Section icon={<DollarSign className="size-4" />} title={t('howto.s3.title')}>
        <p>{t('howto.s3.body')}</p>

        {/* Buy with money */}
        <div className="rounded-xl p-4" style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
          <a
            href="https://portal.arc.io/deposit/fiat"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--brand)' }}
          >
            {t('howto.s3.buyBtn')}
            <ExternalLink className="size-3.5" />
          </a>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--subtle)' }}>
            {t('howto.s3.buyDesc')}
          </p>
        </div>

        {/* Transfer from another wallet */}
        <div className="rounded-xl p-4" style={{ background: 'var(--input-bg)', border: '1px solid var(--border)' }}>
          <a
            href="https://portal.arc.io/deposit/crypto"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: 'transparent' }}
          >
            {t('howto.s3.transferBtn')}
            <ExternalLink className="size-3.5" />
          </a>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--subtle)' }}>
            {t('howto.s3.transferDesc')}
          </p>
        </div>

        {/* Wrong-network warning */}
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-medium"
          style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.12)' }}
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span><strong>{t('howto.s3.networkWarning')}</strong></span>
        </div>

        {/* Copy my address */}
        {isConnected && address ? (
          <button
            onClick={() => { void copyAddress() }}
            className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', color: 'var(--ink)' }}
          >
            {copied
              ? <Check className="size-3.5 shrink-0" style={{ color: 'var(--success)' }} />
              : <Copy className="size-3.5 shrink-0" style={{ color: 'var(--brand)' }} />
            }
            <span className="mono truncate max-w-[220px]">{address}</span>
            <span className="ml-auto shrink-0" style={{ color: copied ? 'var(--success)' : 'var(--brand)' }}>
              {copied ? t('howto.s3.copied') : t('howto.s3.copyAddress')}
            </span>
          </button>
        ) : (
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>{t('howto.s3.connectFirst')}</p>
        )}
      </Section>

      {/* ── Section 4: How a round works ── */}
      <Section icon={<RotateCcw className="size-4" />} title={t('howto.s4.title')}>
        <div className="space-y-3 pt-1">
          <Step n={1} text={t('howto.s4.step1')} />
          <Step n={2} text={t('howto.s4.step2')} />
          <Step n={3} text={t('howto.s4.step3')} />
          <Step n={4} text={t('howto.s4.step4')} />
        </div>
      </Section>

      {/* ── Section 5: FAQ ── */}
      <Section icon={<HelpCircle className="size-4" />} title={t('howto.s5.title')}>
        <div className="space-y-2 pt-1">
          <FaqItem q={t('howto.s5.q1')} a={t('howto.s5.a1')} />
          <FaqItem q={t('howto.s5.q2')} a={t('howto.s5.a2')} />
          <FaqItem q={t('howto.s5.q3')} a={t('howto.s5.a3')} />
          <FaqItem q={t('howto.s5.q4')} a={t('howto.s5.a4')} />
        </div>
      </Section>
    </div>
  )
}
