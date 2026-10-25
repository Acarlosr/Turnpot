/**
 * ThemeToggle — icon button that switches light/dark mode.
 * Shows Sun when in dark mode (click to go light), Moon when in light mode.
 * The icon swaps with a smooth CSS transition.
 */
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex size-8 items-center justify-center rounded-full border transition-opacity hover:opacity-70"
      style={{
        background: 'transparent',
        borderColor: 'var(--border-strong)',
        color: 'var(--ink-2)',
      }}
    >
      <span
        style={{
          display: 'flex',
          transition: 'opacity 0.2s, transform 0.25s',
          opacity: 1,
          transform: 'none',
        }}
      >
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </span>
    </button>
  )
}
