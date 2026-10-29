import { useReadContract, useReadContracts } from 'wagmi'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { useActiveChainConfig } from '@/lib/chain'

export interface PotData {
  members: readonly `0x${string}`[]
  contribution: bigint
  roundDuration: bigint
  currentRound: bigint
  roundStart: bigint
  status: number
}

// Cache reads for 30 s; never auto-refetch — only refresh on explicit user action.
const QUERY_OPTS = { staleTime: 30_000, refetchInterval: false as const }

/** Returns the wagmi contract base for the wallet's active Arc chain. */
function useContractBase() {
  const { chainId, turnpotAddress, isDeployed } = useActiveChainConfig()
  return {
    address: (isDeployed ? turnpotAddress : '0x0000000000000000000000000000000000000000') as `0x${string}`,
    abi: TURNPOT_ABI,
    chainId,
    _enabled: isDeployed,
  }
}

export function usePotCount() {
  const base = useContractBase()
  return useReadContract({
    address: base.address,
    abi: base.abi,
    chainId: base.chainId,
    functionName: 'potCount',
    query: { enabled: base._enabled, ...QUERY_OPTS },
  })
}

export function usePot(potId: bigint | undefined) {
  const base = useContractBase()
  return useReadContract({
    address: base.address,
    abi: base.abi,
    chainId: base.chainId,
    functionName: 'getPot',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: base._enabled && potId !== undefined, ...QUERY_OPTS },
  })
}

export function useRoundDeadline(potId: bigint | undefined) {
  const base = useContractBase()
  return useReadContract({
    address: base.address,
    abi: base.abi,
    chainId: base.chainId,
    functionName: 'roundDeadline',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: base._enabled && potId !== undefined, ...QUERY_OPTS },
  })
}

export function usePaidCount(potId: bigint | undefined) {
  const base = useContractBase()
  return useReadContract({
    address: base.address,
    abi: base.abi,
    chainId: base.chainId,
    functionName: 'paidCount',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: base._enabled && potId !== undefined, ...QUERY_OPTS },
  })
}

export function useHasPaid(
  potId: bigint | undefined,
  round: bigint | undefined,
  member: `0x${string}` | undefined,
) {
  const base = useContractBase()
  return useReadContract({
    address: base.address,
    abi: base.abi,
    chainId: base.chainId,
    functionName: 'hasPaid',
    args:
      potId !== undefined && round !== undefined && member
        ? [potId, round, member]
        : undefined,
    query: { enabled: base._enabled && potId !== undefined && round !== undefined && !!member, ...QUERY_OPTS },
  })
}

export function useMemberDefaults(member: `0x${string}` | undefined) {
  const base = useContractBase()
  return useReadContract({
    address: base.address,
    abi: base.abi,
    chainId: base.chainId,
    functionName: 'defaults',
    args: member ? [member] : undefined,
    query: { enabled: base._enabled && !!member, ...QUERY_OPTS },
  })
}

/** Fetch hasPaid for every member in a round — single multicall */
export function useRoundPayments(
  potId: bigint | undefined,
  round: bigint | undefined,
  members: readonly `0x${string}`[],
) {
  const base = useContractBase()
  return useReadContracts({
    contracts: members.map((m) => ({
      address: base.address,
      abi: base.abi,
      chainId: base.chainId,
      functionName: 'hasPaid' as const,
      args: [potId!, round!, m] as const,
    })),
    query: {
      enabled: base._enabled && potId !== undefined && round !== undefined && members.length > 0,
      ...QUERY_OPTS,
    },
  })
}

/** Fetch defaults for every member — single multicall */
export function useMembersDefaults(members: readonly `0x${string}`[]) {
  const base = useContractBase()
  return useReadContracts({
    contracts: members.map((m) => ({
      address: base.address,
      abi: base.abi,
      chainId: base.chainId,
      functionName: 'defaults' as const,
      args: [m] as const,
    })),
    query: { enabled: base._enabled && members.length > 0, ...QUERY_OPTS },
  })
}

export function useWithdrawableBalance(account: `0x${string}` | undefined) {
  const base = useContractBase()
  return useReadContract({
    address: base.address,
    abi: base.abi,
    chainId: base.chainId,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    query: { enabled: base._enabled && !!account, ...QUERY_OPTS },
  })
}
