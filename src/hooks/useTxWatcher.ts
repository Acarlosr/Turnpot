/**
 * useTxWatcher — waits for a transaction receipt on the ACTIVE chain.
 *
 * Uses wagmi's waitForTransactionReceipt (pollingInterval 4 s, 90 s timeout)
 * so it doesn't hammer the RPC with 1-second polls.
 *
 * Usage:
 *   const { isConfirming, isSuccess, isTimeout, receipt } = useTxWatcher(hash, {
 *     onSuccess: (receipt) => { refetch(); toast.success('Done') },
 *   })
 */

import { useEffect, useRef, useState } from 'react'
import { waitForTransactionReceipt } from '@wagmi/core'
import type { TransactionReceipt } from 'viem'
import { config } from '@/config'

const POLL_INTERVAL_MS = 4_000
const TIMEOUT_MS       = 90_000

export interface TxWatcherResult {
  isConfirming: boolean
  isSuccess:    boolean
  isTimeout:    boolean
  receipt:      TransactionReceipt | undefined
}

export interface TxWatcherOptions {
  onSuccess?: (receipt: TransactionReceipt) => void
  onTimeout?: () => void
  onRevert?:  (receipt: TransactionReceipt) => void
}

export function useTxWatcher(
  hash: `0x${string}` | undefined,
  options: TxWatcherOptions = {},
): TxWatcherResult {

  // Stable option refs — don't re-run the effect when callbacks change identity
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

  // Reset state when hash changes
  const prevHash = useRef<string | undefined>()
  if (hash !== prevHash.current) {
    prevHash.current = hash
    if (hash) {
      setIsConfirming(true)
      setIsSuccess(false)
      setIsTimeout(false)
      setReceipt(undefined)
    } else {
      setIsConfirming(false)
    }
  }

  useEffect(() => {
    if (!hash) {
      setIsConfirming(false)
      return
    }

    let cancelled = false

    async function watch() {
      try {
        const r = await waitForTransactionReceipt(config, {
          hash: hash!,
          pollingInterval: POLL_INTERVAL_MS,
          timeout: TIMEOUT_MS,
        })
        if (cancelled) return
        setReceipt(r)
        setIsConfirming(false)
        if (r.status === 'success') {
          setIsSuccess(true)
          onSuccessRef.current?.(r)
        } else {
          onRevertRef.current?.(r)
        }
      } catch (err) {
        if (cancelled) return
        // waitForTransactionReceipt throws on timeout
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('Timed out') || msg.includes('timeout') || msg.includes('TIMEOUT')) {
          setIsConfirming(false)
          setIsTimeout(true)
          onTimeoutRef.current?.()
        } else {
          // Other error (network) — treat as timeout so UI can recover
          setIsConfirming(false)
          setIsTimeout(true)
          onTimeoutRef.current?.()
        }
      }
    }

    void watch()
    return () => { cancelled = true }
  // Re-run only when hash changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash])

  return { isConfirming, isSuccess, isTimeout, receipt }
}
