'use client'

import { useState } from 'react'
import { Avatar, LevelBadge, ProgressBar, EmptyState } from '@/components/ui'
import { fmtCoins, getLevelProgress, LEVEL_COLORS, type Student, type StoreItem, type PurchaseOrder, type StoreCategory } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── BALANCE HERO ─────────────────────────────────────────────────────────────

interface BalanceHeroProps {
  student:  Student
  onSignOut: () => void
}
export function BalanceHero({ student, onSignOut }: BalanceHeroProps) {
  const lc = LEVEL_COLORS[student.level]
  const { pct, toNext, nextLevel } = getLevelProgress(student.totalEarned)

  return (
    <div
      className="rounded-2xl p-5 mb-5"
      style={{
        background: `linear-gradient(135deg, #1a2744, #0f1f35, ${lc}11)`,
        border: `1.5px solid ${lc}33`,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-slate-600 mb-1">Tu saldo disponible</p>
          <p className="text-4xl font-black text-sp-gold tracking-tight">{fmtCoins(student.balance)}</p>
          <p className="text-sm text-slate-600 mt-1.5">
            {student.name.split(',')[1]?.trim()} {student.name.split(',')[0]}
          </p>
        </div>
        <div className="text-right">
          <LevelBadge level={student.level} />
          {student.streak >= 1 && (
            <p className="text-xs text-orange-400 mt-1.5">🔥 Racha {student.streak}d</p>
          )}
          <button
            onClick={onSignOut}
            className="block mt-2 text-xs text-slate-700 hover:text-slate-500 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {nextLevel && (
        <>
          <div className="flex justify-between text-xs text-slate-600 mb-1.5">
            <span>Progreso a {nextLevel}</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <ProgressBar pct={pct} color={lc} />
          <p className="text-xs text-slate-700 mt-1">{toNext} ₡ para el siguiente nivel</p>
        </>
      )}
    </div>
  )
}

// ─── STORE GRID ───────────────────────────────────────────────────────────────

interface StoreGridProps {
  student:   Student
  items:     StoreItem[]
  orders:    PurchaseOrder[]
  onBuy:     (item: StoreItem) => void
}

const FILTER_LABELS: Record<StoreCategory | 'all', string> = {
  all:      'Todos',
  daily:    'Diarios',
  academic: 'Académicos',
  premium:  '⭐ Premium',
  group:    '👥 Grupales',
}

export function StoreGrid({ student, items, orders, onBuy }: StoreGridProps) {
  const [filter, setFilter] = useState<StoreCategory | 'all'>('all')
  const filters = ['all', ...new Set(items.map(i => i.category))] as (StoreCategory | 'all')[]

  const filtered = items.filter(i => filter === 'all' || i.category === filter)

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="shrink-0 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all"
            style={{
              background:  filter === f ? 'rgba(232,184,75,.15)' : 'transparent',
              borderColor: filter === f ? 'rgba(232,184,75,.4)' : 'rgba(255,255,255,.08)',
              color:       filter === f ? '#e8b84b' : '#6b7280',
            }}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState emoji="🏪" title="Sin items en esta categoría" />
      )}

      <div className="flex flex-col gap-2.5">
        {filtered.map((item) => {
          const canAfford = student.balance >= item.price
          const pending   = orders.some(o => o.item.id === item.id && o.status === 'pending' && o.studentId === student.id)
          const outOfStock = item.stock === 0

          return (
            <div
              key={item.id}
              className="rounded-xl p-4 flex items-center gap-3 transition-all duration-200 hover:border-sp-gold/30"
              style={{
                background: 'rgba(255,255,255,.02)',
                border:     '1px solid rgba(255,255,255,.07)',
                opacity:    canAfford ? 1 : 0.55,
              }}
            >
              <span className="text-2xl shrink-0 w-9 text-center">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 leading-snug">{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base font-black text-sp-gold">{item.price} ₡</span>
                  {item.stock <= 3 && item.stock > 0 && (
                    <span className="text-xs text-red-400 bg-red-950/30 px-1.5 py-0.5 rounded">
                      {item.stock === 1 ? '¡Último!' : `${item.stock} disp.`}
                    </span>
                  )}
                  {outOfStock && (
                    <span className="text-xs text-slate-600">Agotado</span>
                  )}
                </div>
              </div>

              {outOfStock ? (
                <span className="text-xs text-slate-600 shrink-0">Agotado</span>
              ) : pending ? (
                <div
                  className="text-xs font-semibold px-3 py-2 rounded-lg shrink-0"
                  style={{ color: '#fbbf24', background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.2)' }}
                >
                  ⏳ Pendiente
                </div>
              ) : (
                <button
                  onClick={() => canAfford && onBuy(item)}
                  disabled={!canAfford}
                  className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed"
                  style={{
                    background:  canAfford ? 'rgba(232,184,75,.15)' : 'rgba(255,255,255,.04)',
                    border:      `1px solid ${canAfford ? 'rgba(232,184,75,.4)' : 'rgba(255,255,255,.06)'}`,
                    color:       canAfford ? '#e8b84b' : '#374151',
                  }}
                >
                  {canAfford ? 'Canjear' : 'Sin fondos'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ORDER HISTORY ────────────────────────────────────────────────────────────

export function OrderHistory({ orders }: { orders: PurchaseOrder[] }) {
  if (orders.length === 0) {
    return <EmptyState emoji="📜" title="Aún no has canjeado nada" description="Las recompensas que pidas aparecerán aquí" />
  }

  return (
    <div className="flex flex-col gap-2">
      {orders.map((o) => (
        <div
          key={o.id}
          className="flex items-center gap-3 p-3.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}
        >
          <span className="text-xl">{o.item.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-300 truncate">{o.item.name}</p>
            <p className="text-xs text-slate-600 mt-0.5">
              {formatDistanceToNow(o.ts, { locale: es, addSuffix: true })} · {o.item.price} ₡
            </p>
          </div>
          <div
            className="text-xs font-bold px-2.5 py-1 rounded-lg shrink-0"
            style={{
              color:      o.status === 'approved' ? '#4ade80' : o.status === 'rejected' ? '#f87171' : '#fbbf24',
              background: o.status === 'approved' ? 'rgba(74,222,128,.1)' : o.status === 'rejected' ? 'rgba(248,113,113,.1)' : 'rgba(251,191,36,.1)',
            }}
          >
            {o.status === 'approved' ? '✓ Aprobado' : o.status === 'rejected' ? '✗ Rechazado' : '⏳ Pendiente'}
          </div>
        </div>
      ))}
    </div>
  )
}
