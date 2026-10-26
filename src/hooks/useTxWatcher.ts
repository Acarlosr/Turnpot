/**
 * useTxWatcher — polls eth_getTransactionReceipt on the ACTIVE chain's public
 * client directly via viem, bypassing wagmi's receipt hook.
 *
 * Why not useWaitForTransactionReceipt?
 *   wagmi's hook uses its own internal polling state and can silently stall on
 *   fast-finality chains like Arc when the RPC briefly returns null for a receipt
 *   that is already on-chain (indexing lag). This hook polls every 1 s, gives up
 *   after 60 s, and always targets the correct chain's RPC URL.
 *
 * Usage:
 *   const { isConfirming, isSuccess, isTimeout, receipt } = useTxWatcher(hash, {
 *     onSuccess: (receipt) => { refetch(); toast.success('Done') },
 *   })
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPublicClient, http } from 'viem'
import type { TransactionReceipt } from 'viem'
import { CHAIN_CONFIGS, arcMainnet } from '@/lib/chain'
import { useAccount } from 'wagmi'

const POLL_INTERVAL_MS = 1_000
const TIMEOUT_MS = 60_000

export interface TxWatcherResult {
  isConfirming: boolean   // hash set, waiting for receipt
  isSuccess: boolean      // receipt received with status=success
  isTimeout: boolean      // 60 s elapsed, still no receipt
  receipt: TransactionReceipt | undefined
}

export interface TxWatcherOptions {
  onSuccess?: (receipt: TransactionReceipt) => void
  onTimeout?: () => void
  onRevert?: (receipt: TransactionReceipt) => void
}

export function useTxWatcher(
  hash: `0x${string}` | undefined,
  options: TxWatcherOptions = {},
): TxWatcherResult {
  const { chainId } = useAccount()

  // Stable option refs so the effect doesn't re-run when callbacks change identity
  const onSuccessRef = useRef(options.onSuccess)
  const onTimeoutRef = useRef(options.onTimeout)
  const onRevertRef  = useRef(options.onRevert)
  useEffect(() => { onSuccessRef.current = options.onSuccess }, [options.onSuccess])
  useEffect(() => { onTimeoutRef.current = options.onTimeout }, [options.onTimeout])
  useEffect(() => { onRevertRef.current  = options.onRevert  }, [options.onRevert])

  const [isConfirming, setIsConfirming] = useState(false)
  const [isSuccess,    setIsSuccess]    = useState(false)
  const [isTimeout,    setIsTimeout]    = useState(false)
  const [receipt,      setReceipt]      = useState<TransactionReceipt | undefined>()

  // Reset all state when hash changes (new tx started)
  const prevHash = useRef<string | undefined>()
  if (hash !== prevHash.current) {
    prevHash.current = hash
    // Direct state mutation during render is intentional here to avoid stale
    // isSuccess=true flash when a second tx starts — React batches this.
    if (hash) {
      // Only reset if the new hash is different (not the same tx)
      setIsConfirming(true)
      setIsSuccess(false)
      setIsTimeout(false)
      setReceipt(undefined)
    } else {
      setIsConfirming(false)
    }
  }

  const stopRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
  }, [])

  useEffect(() => {
    if (!hash) {
      stop()
      setIsConfirming(false)
      return
    }

    // Build a fresh viem publicClient pointed at the active chain's RPC
    const cfg = chainId !== undefined ? CHAIN_CONFIGS[chainId] : CHAIN_CONFIGS[arcMainnet.id]
    const rpcUrl = cfg?.rpcUrl ?? 'https://rpc.mainnet.arc.io'
    const chain  = cfg?.chain  ?? arcMainnet

    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })

    let cancelled = false
    const startedAt = Date.now()

    async function poll() {
      while (!cancelled) {
        try {
          const r = await client.getTransactionReceipt({ hash: hash! })
          if (cancelled) return
          if (r) {
            setReceipt(r)
            setIsConfirming(false)
            if (r.status === 'success') {
              setIsSuccess(true)
              onSuccessRef.current?.(r)
            } else {
              // reverted
              onRevertRef.current?.(r)
            }
            return
          }
        } catch {
          // receipt not found yet — keep polling
        }

        if (Date.now() - startedAt >= TIMEOUT_MS) {
          if (!cancelled) {
            setIsConfirming(false)
            setIsTimeout(true)
            onTimeoutRef.current?.()
          }
          return
        }

        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
    }

    void poll()

    stopRef.current = () => { cancelled = true }
    return () => { cancelled = true }
  // Re-run only when hash or chainId changes — callbacks are stable via refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, chainId])

  return { isConfirming, isSuccess, isTimeout, receipt }
}
