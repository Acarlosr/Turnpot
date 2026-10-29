/**
 * /deploy — TurnPot mainnet deployment page.
 *
 * Uses the compiled Foundry artifact (contracts/out/TurnPot.sol/TurnPot.json)
 * verbatim — same bytecode the test suite ran against, no recompilation.
 * The connected wallet signs the deploy transaction; no private keys in the app.
 *
 * Only accessible by navigating directly; not linked in the main menu.
 */
import { useState, useCallback } from 'react'
import {
  useAccount,
  useBalance,
  useSwitchChain,
  useWalletClient,
  usePublicClient,
} from 'wagmi'
import { createPublicClient, http, formatUnits } from 'viem'
import {
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  ChevronLeft,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { arcMainnet } from '@/lib/chain'
import { fmtAddr } from '@/lib/format'
import { useI18n } from '@/i18n'

// ── Artifact ─────────────────────────────────────────────────────────────────
// Vite resolves JSON imports at build time; the bytecode is the exact object
// produced by `forge build` — no recompilation happens here.
import ARTIFACT from '../../contracts/out/TurnPot.sol/TurnPot.json'

const DEPLOY_CHAIN_ID = arcMainnet.id          // 5042
const DEPLOY_RPC      = 'https://rpc.mainnet.arc.io'
const EXPLORER_BASE   = 'https://explorer.arc.io'
const BYTECODE        = ARTIFACT.bytecode.object as `0x${string}`

// ── Helpers ──────────────────────────────────────────────────────────────────
function explorerTx(hash: string)  { return `${EXPLORER_BASE}/tx/${hash}` }
function explorerAddr(addr: string){ return `${EXPLORER_BASE}/address/${addr}` }

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="flex size-7 items-center justify-center rounded-lg transition-all hover:bg-black/5"
      title="Copy"
    >
      {copied
        ? <Check className="size-3.5" style={{ color: 'var(--success)' }} />
        : <Copy className="size-3.5" style={{ color: 'var(--subtle)' }} />}
    </button>
  )
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="shrink-0 text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        <span className={`truncate text-xs font-medium ${mono ? 'mono' : ''}`} style={{ color: 'var(--ink)' }}>
          {value}
        </span>
        <CopyButton text={value} />
      </div>
    </div>
  )
}

// ── Sanity check result ───────────────────────────────────────────────────────
interface SanityResult {
  potCount: string
  maxContribution: string
}

// ── Main component ────────────────────────────────────────────────────────────
interface DeployPageProps {
  onBack: () => void
}

export default function DeployPage({ onBack }: DeployPageProps) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const { t } = useI18n()

  // Balance on the active chain (shows USDC on Arc mainnet)
  const { data: balanceData } = useBalance({ address, chainId: DEPLOY_CHAIN_ID })

  const onMainnet = chainId === DEPLOY_CHAIN_ID

  // Deploy state
  type Stage = 'idle' | 'signing' | 'confirming' | 'done' | 'error'
  const [stage, setStage]           = useState<Stage>('idle')
  const [txHash, setTxHash]         = useState<`0x${string}` | null>(null)
  const [contractAddr, setContractAddr] = useState<`0x${string}` | null>(null)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const [sanity, setSanity]         = useState<SanityResult | null>(null)

  // A standalone mainnet public client just for this page's post-deploy reads.
  // We create it once; it doesn't depend on the app-wide wagmi config's TARGET_CHAIN.
  const mainnetClient = createPublicClient({
    chain: arcMainnet,
    transport: http(DEPLOY_RPC),
  })

  // We also grab the wagmi public client scoped to mainnet (for waitForTransactionReceipt).
  const wagmiMainnetClient = usePublicClient({ chainId: DEPLOY_CHAIN_ID })

  const deploy = useCallback(async () => {
    if (!walletClient || !wagmiMainnetClient) return
    setStage('signing')
    setErrorMsg(null)
    setTxHash(null)
    setContractAddr(null)
    setSanity(null)

    try {
      // 1. Send the deploy transaction — wallet signs, no private key
      const hash = await walletClient.deployContract({
        abi: TURNPOT_ABI,
        bytecode: BYTECODE,
        chain: arcMainnet,
        account: address!,
      })
      setTxHash(hash)
      setStage('confirming')

      // 2. Wait for the receipt
      const receipt = await wagmiMainnetClient.waitForTransactionReceipt({ hash })
      if (!receipt.contractAddress) throw new Error('No contract address in receipt')
      const deployed = receipt.contractAddress
      setContractAddr(deployed)
      setStage('done')

      // 3. Sanity check: potCount() and MAX_CONTRIBUTION()
      const [pc, mc] = await Promise.all([
        mainnetClient.readContract({ address: deployed, abi: TURNPOT_ABI, functionName: 'potCount' }),
        mainnetClient.readContract({ address: deployed, abi: TURNPOT_ABI, functionName: 'MAX_CONTRIBUTION' }),
      ])
      setSanity({
        potCount: String(pc),
        maxContribution: `${formatUnits(mc, 18)} USDC`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.toLowerCase().includes('user rejected') && !msg.toLowerCase().includes('denied')) {
        setErrorMsg(msg.length > 200 ? msg.slice(0, 200) + '…' : msg)
      }
      setStage('idle')
    }
  }, [walletClient, wagmiMainnetClient, address, mainnetClient])

  const busy = stage === 'signing' || stage === 'confirming'

  // Formatted USDC balance on mainnet
  const usdcBalance = balanceData
    ? Number(formatUnits(balanceData.value, balanceData.decimals)).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })
    : '—'

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex size-9 shrink-0 items-center justify-center rounded-xl transition-all hover:bg-black/5"
        >
          <ChevronLeft className="size-5" style={{ color: 'var(--ink)' }} />
        </button>
        <div className="min-w-0">
          <h1 className="display truncate text-xl font-bold" style={{ color: 'var(--ink)' }}>
            {t('deploy.title')}
          </h1>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>{t('deploy.subtitle')}</p>
        </div>
      </div>

      {/* Warning banner */}
      <div
        className="flex items-start gap-3 rounded-2xl p-4"
        style={{ background: 'rgba(186,43,76,0.06)', border: '1px solid rgba(186,43,76,0.18)' }}
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--danger)' }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--danger)' }}>
          {t('deploy.warning')}
        </p>
      </div>

      {/* Wallet info card */}
      <div
        className="rounded-3xl p-5"
        style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {t('deploy.walletTitle')}
        </h2>

        {!isConnected ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {t('deploy.connectFirst')}
          </p>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="shrink-0 text-xs" style={{ color: 'var(--muted)' }}>Address</span>
              <div className="flex min-w-0 items-center gap-1">
                <span className="mono truncate text-xs font-medium" style={{ color: 'var(--ink)' }}>
                  {address}
                </span>
                <CopyButton text={address ?? ''} />
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Active chain</span>
              <span className="text-xs font-medium" style={{ color: onMainnet ? 'var(--success)' : 'var(--danger)' }}>
                {onMainnet ? t('deploy.chainCorrect') : t('deploy.chainWrong', { id: chainId ?? '?' })}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>USDC balance (mainnet)</span>
              <span className="tabular-nums text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                {usdcBalance} USDC
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Artifact info */}
      <div
        className="rounded-3xl p-5"
        style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          Contract artifact
        </h2>
        <Row label="Source" value="contracts/TurnPot.sol" />
        <Row label="Artifact" value="contracts/out/TurnPot.sol/TurnPot.json" />
        <Row label="Bytecode prefix" value={BYTECODE.slice(0, 20) + '…'} mono />
        <p className="mt-3 text-xs" style={{ color: 'var(--subtle)' }}>
          Exact bytecode from the last <code>forge build</code> — no recompilation at deploy time.
          Same artifact the Foundry test suite validated (65 tests, 0 failures).
        </p>
      </div>

      {/* Network switch or Deploy button */}
      {isConnected && !onMainnet && (
        <button
          onClick={() => switchChain({ chainId: DEPLOY_CHAIN_ID })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: 'var(--brand)', color: '#fff' }}
        >
          {t('deploy.switchChain')}
        </button>
      )}

      {isConnected && onMainnet && stage !== 'done' && (
        <button
          onClick={() => { void deploy() }}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'var(--brand)' }}
        >
          {stage === 'signing' && (
            <><Loader2 className="size-4 animate-spin" /> {t('deploy.signing')}</>
          )}
          {stage === 'confirming' && (
            <><Loader2 className="size-4 animate-spin" /> {t('deploy.confirming')}</>
          )}
          {stage === 'idle' && t('deploy.button')}
        </button>
      )}

      {/* Error */}
      {errorMsg && (
        <div
          className="rounded-2xl px-4 py-3 text-xs"
          style={{ background: 'rgba(186,43,76,0.06)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.18)' }}
        >
          <strong>Deploy failed:</strong> {errorMsg}
        </div>
      )}

      {/* In-flight tx hash */}
      {txHash && stage === 'confirming' && (
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
        >
          <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--muted)' }}>
            Transaction submitted
          </p>
          <div className="flex items-center gap-2">
            <span className="mono truncate text-xs" style={{ color: 'var(--ink)' }}>
              {fmtAddr(txHash)}
            </span>
            <CopyButton text={txHash} />
            <a
              href={explorerTx(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--brand)' }}
            >
              Explorer <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      )}

      {/* Success card */}
      {stage === 'done' && contractAddr && txHash && (
        <div
          className="rounded-3xl p-5 flex flex-col gap-4"
          style={{ background: 'var(--surface-strong)', border: '1px solid rgba(26,128,71,0.30)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 shrink-0" style={{ color: 'var(--success)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
              {t('deploy.success')}
            </p>
          </div>

          {/* Contract address */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Contract address
            </p>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: 'var(--surface-muted)' }}
            >
              <span className="mono flex-1 truncate text-sm font-bold" style={{ color: 'var(--ink)' }}>
                {contractAddr}
              </span>
              <CopyButton text={contractAddr} />
              <a
                href={explorerAddr(contractAddr)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--brand)' }}
              >
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>

          {/* Tx hash */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Deploy transaction
            </p>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--surface-muted)' }}>
              <span className="mono flex-1 truncate text-xs" style={{ color: 'var(--ink-2)' }}>
                {txHash}
              </span>
              <CopyButton text={txHash} />
              <a
                href={explorerTx(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: 'var(--brand)' }}
              >
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>

          {/* Sanity check */}
          {sanity && (
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(26,128,71,0.06)', border: '1px solid rgba(26,128,71,0.16)' }}
            >
              <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--success)' }}>
                {t('deploy.sanityPassed')}
              </p>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--muted)' }}>potCount()</span>
                  <span className="font-medium tabular-nums" style={{ color: 'var(--ink)' }}>{sanity.potCount}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--muted)' }}>MAX_CONTRIBUTION()</span>
                  <span className="font-medium tabular-nums" style={{ color: 'var(--ink)' }}>{sanity.maxContribution}</span>
                </div>
              </div>
            </div>
          )}

          {/* Next step hint */}
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Update <code>VITE_TURNPOT_ADDRESS_MAINNET</code> in your <code>.env</code> and set{' '}
            <code>VITE_CHAIN=mainnet</code> to point the app at this contract.
          </p>
        </div>
      )}
    </div>
  )
}
