/**
 * useTheme — light/dark theme toggle.
 *
 * - Default: system preference (prefers-color-scheme: dark).
 * - Persists choice to localStorage under key "turnpot-theme".
 * - Applies by toggling the "dark" class on <html>.
 */
import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'
const LS_KEY = 'turnpot-theme'

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage blocked
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(t: Theme) {
  if (t === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

// Initialise as early as possible (module evaluation, before React renders).
// This prevents a flash of the wrong theme on first paint.
if (typeof window !== 'undefined') {
  applyTheme(getInitialTheme())
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(LS_KEY, theme)
    } catch {
      // localStorage blocked
    }
  }, [theme])

  function toggle() {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggle } as const
}
