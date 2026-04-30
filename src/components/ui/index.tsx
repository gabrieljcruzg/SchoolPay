'use client'

import { LEVEL_COLORS, type Level } from '@/types'
import { type Toast } from '@/hooks/useToast'

// ─── AVATAR ───────────────────────────────────────────────────────────────────
interface AvatarProps {
  initials: string
  level:    Level
  size?:    number  // px
}
export function Avatar({ initials, level, size = 36 }: AvatarProps) {
  const color = LEVEL_COLORS[level]
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0,
        background: `${color}22`,
        border: `1.5px solid ${color}`,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, color: '#f1f5f9',
      }}
    >
      {initials}
    </div>
  )
}

// ─── LEVEL BADGE ──────────────────────────────────────────────────────────────
export function LevelBadge({ level }: { level: Level }) {
  const color = LEVEL_COLORS[level]
  return (
    <span
      style={{
        fontSize: 11, padding: '2px 10px', borderRadius: 50, fontWeight: 600,
        background: `${color}22`, color, border: `1px solid ${color}44`,
      }}
    >
      {level}
    </span>
  )
}

// ─── COIN DISPLAY ─────────────────────────────────────────────────────────────
export function CoinAmount({ amount, size = 'md' }: { amount: number; size?: 'sm' | 'md' | 'lg' }) {
  const positive = amount >= 0
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' }
  return (
    <span className={`font-bold tabular-nums ${sizes[size]} ${positive ? 'text-green-400' : 'text-red-400'}`}>
      {positive ? '+' : ''}{amount.toLocaleString('es-MX')} ₡
    </span>
  )
}

// ─── SPINNER ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity=".25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
export function EmptyState({ emoji, title, description }: { emoji: string; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <div className="text-4xl">{emoji}</div>
      <div className="text-sm font-semibold text-slate-400">{title}</div>
      {description && <div className="text-xs text-slate-600 max-w-xs">{description}</div>}
    </div>
  )
}

// ─── TOAST LIST ───────────────────────────────────────────────────────────────
export function ToastList({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-slide-up flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl"
          style={{
            background: t.type === 'ok' ? '#052e16' : t.type === 'err' ? '#2d1515' : '#0c1a2e',
            border: `1px solid ${t.type === 'ok' ? '#16a34a' : t.type === 'err' ? '#dc2626' : '#2563eb'}`,
          }}
        >
          <span className="text-sm flex-1" style={{ color: t.type === 'ok' ? '#86efac' : t.type === 'err' ? '#fca5a5' : '#93c5fd' }}>
            {t.msg}
          </span>
          {t.undoFn && (
            <button
              onClick={() => { t.undoFn!(); onDismiss(t.id) }}
              className="text-xs font-medium text-slate-300 bg-white/10 rounded-md px-2.5 py-1 shrink-0"
            >
              ↩ Deshacer
            </button>
          )}
          <button onClick={() => onDismiss(t.id)} className="text-slate-600 text-sm shrink-0">✕</button>
        </div>
      ))}
    </div>
  )
}

// ─── PROGRESS BAR ─────────────────────────────────────────────────────────────
export function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)` }}
      />
    </div>
  )
}

// ─── NFC SCANNER BUTTON ───────────────────────────────────────────────────────
import { type NFCScanStatus } from '@/hooks/useNFC'

interface NFCButtonProps {
  status:    NFCScanStatus
  onStart:   () => void
  onStop:    () => void
}
export function NFCButton({ status, onStart, onStop }: NFCButtonProps) {
  const isScanning = status === 'scanning'
  const isSuccess  = status === 'success'

  return (
    <button
      onClick={isScanning ? onStop : onStart}
      className={`
        w-full flex items-center justify-center gap-3 rounded-xl py-4
        font-semibold text-sm transition-all duration-200 active:scale-95
        ${isScanning
          ? 'bg-sp-gold/20 border border-sp-gold/40 text-sp-gold'
          : isSuccess
            ? 'bg-green-950/50 border border-green-600/40 text-green-400'
            : 'bg-sp-bg3 border border-white/10 text-slate-400 hover:border-sp-gold/30 hover:text-sp-gold'}
      `}
    >
      {isScanning ? (
        <>
          <div className="relative w-5 h-5">
            <div className="absolute inset-0 rounded-full border-2 border-sp-gold/40 animate-ping" />
            <div className="absolute inset-0.5 rounded-full border-2 border-sp-gold" />
          </div>
          <span>Esperando tarjeta… (toca para cancelar)</span>
        </>
      ) : isSuccess ? (
        <><span className="text-lg">✓</span><span>¡Tarjeta leída!</span></>
      ) : (
        <><span className="text-xl">📡</span><span>Escanear tarjeta NFC</span></>
      )}
    </button>
  )
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs uppercase tracking-widest text-slate-600 font-medium">{title}</h2>
      {action}
    </div>
  )
}
