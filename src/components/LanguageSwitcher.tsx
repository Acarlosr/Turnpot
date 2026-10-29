/**
 * LanguageSwitcher — flag button + dropdown.
 * Always visible (connected or not, any screen size).
 * Height and border style matches ThemeToggle.
 */
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { type Locale, setLocale, useI18n } from '@/i18n'

// ─── Flag SVGs (inline, no emoji, no external assets) ────────────────────────

function FlagBR({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 14" width={size} height={Math.round(size * 0.7)} aria-hidden="true" style={{ display: 'block' }}>
      <rect width="20" height="14" fill="#009B3A" />
      <polygon points="10,1.5 18.5,7 10,12.5 1.5,7" fill="#FEDF00" />
      <circle cx="10" cy="7" r="3.2" fill="#002776" />
      <path d="M6.9 6.2 Q10 5.0 13.1 6.2" stroke="white" strokeWidth="0.65" fill="none" />
    </svg>
  )
}

function FlagUS({ size = 18 }: { size?: number }) {
  const h = Math.round(size * 0.7)
  return (
    <svg viewBox="0 0 20 14" width={size} height={h} aria-hidden="true" style={{ display: 'block' }}>
      {[0,1,2,3,4,5,6,7,8,9,10,11,12].map((i) => (
        <rect key={i} x="0" y={i * (14/13)} width="20" height={14/13}
          fill={i % 2 === 0 ? '#B22234' : '#FFFFFF'} />
      ))}
      <rect x="0" y="0" width="8" height="7.5" fill="#3C3B6E" />
      {[0,1,2,3,4].map((col) => [0,1,2].map((row) => (
        <circle key={`a-${col}-${row}`} cx={0.8 + col * 1.4} cy={0.9 + row * 1.8} r="0.28" fill="white" />
      )))}
      {[0,1,2,3].map((col) => [0,1,2,3].map((row) => (
        <circle key={`b-${col}-${row}`} cx={1.5 + col * 1.4} cy={1.8 + row * 1.8} r="0.28" fill="white" />
      )))}
    </svg>
  )
}

function FlagES({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 20 14" width={size} height={Math.round(size * 0.7)} aria-hidden="true" style={{ display: 'block' }}>
      <rect width="20" height="14" fill="#c60b1e" />
      <rect x="0" y="3.5" width="20" height="7" fill="#ffc400" />
    </svg>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

interface LangOption {
  locale: Locale
  label: string
  Flag: (props: { size?: number }) => JSX.Element
}

const OPTIONS: LangOption[] = [
  { locale: 'en',   label: 'English',             Flag: FlagUS },
  { locale: 'pt-BR',label: 'Português',            Flag: FlagBR },
  { locale: 'es',   label: 'Español',              Flag: FlagES },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function LanguageSwitcher() {
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function select(l: Locale) {
    setLocale(l)
    setOpen(false)
  }

  const active = OPTIONS.find((o) => o.locale === locale) ?? OPTIONS[0]
  const { Flag: ActiveFlag } = active

  return (
    <div ref={ref} className="relative">
      {/* Trigger button — same height/border as ThemeToggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Language: ${active.label}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-8 items-center gap-1 rounded-full border px-2 transition-opacity hover:opacity-70"
        style={{
          background: 'transparent',
          borderColor: 'var(--border-strong)',
          color: 'var(--ink-2)',
        }}
      >
        <ActiveFlag size={18} />
        <ChevronDown
          className="size-3 shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-2xl py-1 shadow-xl"
          style={{
            background: 'var(--surface-strong)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {OPTIONS.map(({ locale: l, label, Flag }) => {
            const isActive = l === locale
            return (
              <button
                key={l}
                role="option"
                aria-selected={isActive}
                onClick={() => select(l)}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: isActive ? 'var(--brand)' : 'var(--ink-2)' }}
              >
                <Flag size={18} />
                <span className={isActive ? 'font-semibold' : ''}>{label}</span>
                {isActive && (
                  <Check className="ml-auto size-3.5 shrink-0" style={{ color: 'var(--brand)' }} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
