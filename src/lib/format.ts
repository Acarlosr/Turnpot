/**
 * Formatting helpers for amounts, addresses, and time.
 * All USDC amounts on Arc use 18-decimal native (msg.value / balanceOf in contract).
 */
import { formatUnits } from 'viem'

/** Format a native-USDC bigint (18 dec) to a readable USDC string like "0.50" */
export function fmtUsdc(raw: bigint | undefined | null): string {
  if (raw === undefined || raw === null) return '—'
  return Number(formatUnits(raw, 18)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
}

/** Shorten a hex address: 0x1234…abcd */
export function fmtAddr(addr: string | undefined): string {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Format a unix timestamp as a countdown "2 m 30 s" or "Expired" */
export function fmtCountdown(deadlineSeconds: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = deadlineSeconds - now
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const mins = Math.floor((diff % 3600) / 60)
  const secs = diff % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

/** Format a round duration (seconds) as a human label */
export function fmtDuration(seconds: bigint | number): string {
  const s = Number(seconds)
  if (s < 3600) return `${Math.round(s / 60)} min`
  if (s < 86400) return `${Math.round(s / 3600)} hr`
  if (s < 7 * 86400) return `${Math.round(s / 86400)} day`
  return `${Math.round(s / (7 * 86400))} wk`
}

/** Status enum from contract: 0=Active, 1=Completed, 2=Cancelled */
export function fmtStatus(status: number): string {
  return ['Active', 'Completed', 'Cancelled'][status] ?? 'Unknown'
}
