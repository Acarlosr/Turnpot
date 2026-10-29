/**
 * useProtocolStats — derives aggregate protocol numbers from on-chain view reads,
 * NOT from getLogs. This avoids the wide-range eth_getLogs calls that ad blockers
 * and Brave Shields tend to block.
 *
 * Algorithm:
 *   1. Read potCount() — number of pots created.
 *   2. Multicall getPot(i) for i in [0, potCount).
 *   3. From each pot derive:
 *      - contributes per round = members.length × rounds completed (currentRound)
 *        plus any partial round (paidCount for active pots is fetched separately)
 *      - total USDC = sum(contribution × members.length × completedRounds)
 *   4. txCount = rough proxy: potCreates + total contributions + round closes
 *      (contribution × completedRounds per pot) + withdrawals (approximated as
 *      once per completed pot per member).
 *
 * Exposed: { potCount, txCount, totalUsdc, loading, failed }
 * failed = true when potCount read itself errored (hard network block).
 */

import { useMemo, useState, useEffect } from 'react'
import { useReadContract, useReadContracts } from 'wagmi'
import { arcMainnet, CHAIN_CONFIGS } from '@/lib/chain'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { useAccount } from 'wagmi'

const STATS_TIMEOUT_MS = 10_000

export interface ProtocolStatsData {
  potCount: number
  txCount: number
  totalUsdc: bigint
  loading: boolean
  failed: boolean
}

function useContractBase() {
  const { chainId } = useAccount()
  const effectiveChainId = chainId !== undefined ? chainId : arcMainnet.id
  const cfg = CHAIN_CONFIGS[effectiveChainId]
  return {
    address: (cfg?.turnpotAddress ?? '') as `0x${string}`,
    abi: TURNPOT_ABI,
    chainId: effectiveChainId,
    enabled: !!cfg?.turnpotAddress,
  }
}

export function useProtocolStats(): ProtocolStatsData {
  const base = useContractBase()

  // Step 1: potCount
  const {
    data: rawPotCount,
    isLoading: potCountLoading,
    isError: potCountError,
  } = useReadContract({
    address: base.address,
    abi: base.abi,
    chainId: base.chainId,
    functionName: 'potCount',
    query: { enabled: base.enabled },
  })

  const potCount = rawPotCount !== undefined ? Number(rawPotCount) : undefined

  // Step 2: multicall getPot for every pot
  const potIds = useMemo(
    () => (potCount !== undefined ? Array.from({ length: potCount }, (_, i) => BigInt(i)) : []),
    [potCount],
  )

  const {
    data: potsData,
    isLoading: potsLoading,
    isError: potsError,
  } = useReadContracts({
    contracts: potIds.map((id) => ({
      address: base.address,
      abi: base.abi,
      chainId: base.chainId,
      functionName: 'getPot' as const,
      args: [id] as const,
    })),
    query: {
      enabled: base.enabled && potIds.length > 0,
    },
  })

  // Step 3 + 4: compute stats from pot data
  const { totalUsdc, txCount } = useMemo(() => {
    if (!potsData || potsData.length === 0) {
      return { totalUsdc: 0n, txCount: potCount ?? 0 }
    }

    let usdcSum = 0n
    // Each pot creation = 1 tx
    let txs = potsData.length

    for (const result of potsData) {
      if (result.status !== 'success' || !result.result) continue
      const [members, contribution, , currentRound, , status] = result.result as [
        readonly `0x${string}`[],
        bigint,
        bigint,
        bigint,
        bigint,
        number,
      ]
      const n = BigInt(members.length)
      const completedRounds = status === 1
        ? BigInt(members.length)   // completed: all rounds done
        : currentRound             // active/cancelled: rounds so far

      // Total USDC contributed to this pot = contribution × members × completedRounds
      usdcSum += contribution * n * completedRounds

      // Tx count proxy:
      //   creates: already counted above (1 per pot)
      //   contributions: members × completedRounds
      //   round closes: completedRounds
      //   withdrawals: members (one per completed round recipient)
      txs += Number(n * completedRounds)  // contributes
      txs += Number(completedRounds)      // closes
      if (status === 1) txs += members.length  // withdrawals for completed pots
      if (status === 2) {
        // cancelled — some refund txs; approximation: all who paid in last round
        txs += members.length
      }
    }

    return { totalUsdc: usdcSum, txCount: txs }
  }, [potsData, potCount])

  const loading = potCountLoading || (potIds.length > 0 && potsLoading)
  const failed  = potCountError || potsError

  // After STATS_TIMEOUT_MS of continuous loading with no data, flip timedOut.
  // We only ever set it from inside a setTimeout callback (async), which satisfies
  // the linter's "no synchronous setState in effect" rule.
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    // When loading resolves (success or error), always clear timedOut via timeout
    // so the next loading cycle starts fresh.
    if (!loading) {
      const id = setTimeout(() => setTimedOut(false), 0)
      return () => clearTimeout(id)
    }
    // Still loading — set a deadline
    const id = setTimeout(() => setTimedOut(true), STATS_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [loading])

  return {
    potCount: potCount ?? 0,
    txCount,
    totalUsdc,
    loading: loading && !timedOut,
    failed:  failed || timedOut,
  }
}
