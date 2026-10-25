import { useEffect, useState } from 'react'
import { fmtCountdown } from '@/lib/format'

export default function Countdown({ deadline }: { deadline: number }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const label = fmtCountdown(deadline)
  const expired = label === 'Expired'
  return (
    <span
      className="tabular-nums font-medium"
      style={{ color: expired ? 'var(--danger)' : 'var(--muted)' }}
    >
      {label}
    </span>
  )
}
