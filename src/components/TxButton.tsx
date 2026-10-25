/**
 * A transaction CTA that cycles through idle → wallet confirm → confirming → success/error.
 * Caller owns writeContract; this component just renders state.
 */
import { Loader2 } from 'lucide-react'

interface TxButtonProps {
  label: string
  loadingLabel?: string
  disabled?: boolean
  isPending: boolean
  isConfirming: boolean
  onClick: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  className?: string
}

export default function TxButton({
  label,
  loadingLabel,
  disabled,
  isPending,
  isConfirming,
  onClick,
  variant = 'primary',
  className = '',
}: TxButtonProps) {
  const busy = isPending || isConfirming
  const styles: Record<string, string> = {
    primary:
      'rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40',
    ghost:
      'rounded-xl py-2.5 text-sm font-medium border transition-all hover:bg-black/5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40',
    danger:
      'rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40',
  }
  const bg: Record<string, React.CSSProperties> = {
    primary: { background: busy ? 'var(--accent)' : 'var(--accent)' },
    ghost: {
      background: 'transparent',
      borderColor: 'var(--border-strong)',
      color: 'var(--ink)',
    },
    danger: { background: 'rgba(186,43,76,0.10)', color: 'var(--danger)' },
  }

  return (
    <button
      disabled={disabled || busy}
      onClick={onClick}
      className={`${styles[variant]} ${className}`}
      style={bg[variant]}
    >
      {busy ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          {isConfirming
            ? 'Confirming…'
            : loadingLabel ?? 'Confirm in wallet…'}
        </span>
      ) : (
        label
      )}
    </button>
  )
}
