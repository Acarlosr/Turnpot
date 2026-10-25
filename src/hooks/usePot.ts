import { useReadContract, useReadContracts } from 'wagmi'
import { TURNPOT_ABI } from '@/lib/turnpot-abi'
import { TURNPOT_ADDRESS, TARGET_CHAIN_ID } from '@/lib/chain'

export interface PotData {
  members: readonly `0x${string}`[]
  contribution: bigint
  roundDuration: bigint
  currentRound: bigint
  roundStart: bigint
  status: number
}

const base = {
  address: TURNPOT_ADDRESS,
  abi: TURNPOT_ABI,
  chainId: TARGET_CHAIN_ID,
} as const

export function usePotCount() {
  return useReadContract({ ...base, functionName: 'potCount' })
}

export function usePot(potId: bigint | undefined) {
  return useReadContract({
    ...base,
    functionName: 'getPot',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: potId !== undefined },
  })
}

export function useRoundDeadline(potId: bigint | undefined) {
  return useReadContract({
    ...base,
    functionName: 'roundDeadline',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: potId !== undefined },
  })
}

export function usePaidCount(potId: bigint | undefined) {
  return useReadContract({
    ...base,
    functionName: 'paidCount',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: potId !== undefined },
  })
}

export function useHasPaid(
  potId: bigint | undefined,
  round: bigint | undefined,
  member: `0x${string}` | undefined,
) {
  return useReadContract({
    ...base,
    functionName: 'hasPaid',
    args:
      potId !== undefined && round !== undefined && member
        ? [potId, round, member]
        : undefined,
    query: { enabled: potId !== undefined && round !== undefined && !!member },
  })
}

export function useMemberDefaults(member: `0x${string}` | undefined) {
  return useReadContract({
    ...base,
    functionName: 'defaults',
    args: member ? [member] : undefined,
    query: { enabled: !!member },
  })
}

/** Fetch hasPaid for every member in a round */
export function useRoundPayments(
  potId: bigint | undefined,
  round: bigint | undefined,
  members: readonly `0x${string}`[],
) {
  return useReadContracts({
    contracts: members.map((m) => ({
      ...base,
      functionName: 'hasPaid' as const,
      args: [potId!, round!, m] as const,
    })),
    query: {
      enabled: potId !== undefined && round !== undefined && members.length > 0,
    },
  })
}

/** Fetch defaults for every member */
export function useMembersDefaults(members: readonly `0x${string}`[]) {
  return useReadContracts({
    contracts: members.map((m) => ({
      ...base,
      functionName: 'defaults' as const,
      args: [m] as const,
    })),
    query: { enabled: members.length > 0 },
  })
}

export function useWithdrawableBalance(account: `0x${string}` | undefined) {
  return useReadContract({
    ...base,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    query: { enabled: !!account },
  })
}
