/**
 * BlockedBanner — shown once when network reads are failing (ad blocker / Brave Shields).
 * Dismissible; dismissal persists in sessionStorage so it doesn't re-appear on navigation.
 */
import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useI18n } from '@/i18n'

const SESSION_KEY = 'turnpot-blocked-dismissed'

interface BlockedBannerProps {
  /** Show the banner only when this is true */
  show: boolean
}

export default function BlockedBanner({ show }: BlockedBannerProps) {
  const { t } = useI18n()
  const [dismissedAt, setDismissedAt] = useState<number | null>(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === '1' ? Date.now() : null } catch { return null }
  })
  // If show toggled back to false (reads recovered), clear the dismiss so the banner
  // can re-appear if reads fail again later — derive it during render, no effect needed.
  const effectiveDismissed = dismissedAt !== null && show

  if (!show || effectiveDismissed) return null

  function handleDismiss() {
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
    setDismissedAt(Date.now())
  }

  return (
    <div
      className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
      style={{
        background: 'color-mix(in srgb, #f59e0b 10%, transparent)',
        border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
        color: '#92400e',
      }}
      role="alert"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
      <span className="flex-1 dark:text-amber-300">{t('network.blocked')}</span>
      <button
        onClick={handleDismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="size-4 dark:text-amber-300" />
      </button>
    </div>
  )
}
