/**
 * Returns all pot IDs where the connected address is a member,
 * by scanning from pot 0 to potCount-1 and checking members[].
 * Max 10 members * up to 500 pots = bounded RPC calls, batched via useReadContracts.
 */
import { useReadContracts } from 'wagmi'
import { usePotCount } from './usePot'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { TURNPOT_ADDRESS, TARGET_CHAIN_ID } from '@/lib/chain'

const MAX_SCAN = 200 // scan at most 200 pots

export function useMyPots(address: `0x${string}` | undefined) {
  const { data: potCount } = usePotCount()

  const count = potCount !== undefined ? Number(potCount) : 0
  const scanCount = Math.min(count, MAX_SCAN)

  const potIds = Array.from({ length: scanCount }, (_, i) => BigInt(i))

  const { data: potsData, isLoading } = useReadContracts({
    contracts: potIds.map((id) => ({
      address: TURNPOT_ADDRESS,
      abi: TURNPOT_ABI,
      functionName: 'getPot' as const,
      args: [id] as const,
      chainId: TARGET_CHAIN_ID,
    })),
    query: { enabled: !!address && scanCount > 0 },
  })

  const myPotIds: bigint[] = []

  if (address && potsData) {
    for (let i = 0; i < potsData.length; i++) {
      const result = potsData[i]
      if (result.status === 'success' && result.result) {
        const members = result.result[0]
        if (members.some((m) => m.toLowerCase() === address.toLowerCase())) {
          myPotIds.push(BigInt(i))
        }
      }
    }
  }

  return { myPotIds, isLoading: isLoading && !!address }
}
