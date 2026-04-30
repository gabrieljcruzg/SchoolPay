'use client'

import { useState } from 'react'
import { Avatar, EmptyState, SectionHeader } from '@/components/ui'
import { type PurchaseOrder } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface OrdersPanelProps {
  orders:        PurchaseOrder[]
  onApprove:     (orderId: string) => void
  onReject:      (orderId: string) => void
}

export function OrdersPanel({ orders, onApprove, onReject }: OrdersPanelProps) {
  const pending  = orders.filter(o => o.status === 'pending')
  const resolved = orders.filter(o => o.status !== 'pending')
  const [showAll, setShowAll] = useState(false)

  return (
    <div>
      {pending.length === 0 && resolved.length === 0 && (
        <EmptyState
          emoji="🛒"
          title="Sin órdenes aún"
          description="Aparecerán aquí cuando un alumno canjee algo en la tienda"
        />
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="mb-4">
          <SectionHeader title={`Pendientes (${pending.length})`} />
          <div className="flex flex-col gap-2">
            {pending.map((o) => (
              <OrderCard key={o.id} order={o} onApprove={onApprove} onReject={onReject} />
            ))}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <SectionHeader
            title="Resueltas"
            action={
              <button
                onClick={() => setShowAll(p => !p)}
                className="text-xs text-slate-600 hover:text-slate-400"
              >
                {showAll ? 'Ocultar' : `Ver todas (${resolved.length})`}
              </button>
            }
          />
          {showAll && (
            <div className="flex flex-col gap-2">
              {resolved.map((o) => (
                <OrderCard key={o.id} order={o} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OrderCard({
  order,
  onApprove,
  onReject,
}: {
  order: PurchaseOrder
  onApprove?: (id: string) => void
  onReject?:  (id: string) => void
}) {
  const isPending = order.status === 'pending'
  const ago = formatDistanceToNow(order.ts, { locale: es, addSuffix: true })

  return (
    <div
      className="rounded-xl p-3 transition-opacity"
      style={{
        background:   isPending ? 'rgba(232,184,75,0.05)' : 'rgba(255,255,255,0.02)',
        border:       `1px solid ${isPending ? 'rgba(232,184,75,0.2)' : 'rgba(255,255,255,0.05)'}`,
        opacity:      isPending ? 1 : 0.55,
        animation:    isPending ? 'fadeIn .2s ease' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-sp-bg3 flex items-center justify-center text-xs font-bold shrink-0">
          {order.studentAvatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-slate-200 truncate">
            {order.studentName.split(',')[0]}
          </div>
          <div className="text-xs text-slate-700">{ago}</div>
        </div>
        {!isPending && (
          <span
            className="text-xs font-semibold"
            style={{ color: order.status === 'approved' ? '#4ade80' : '#f87171' }}
          >
            {order.status === 'approved' ? '✓ Aprobada' : '✗ Rechazada'}
          </span>
        )}
      </div>

      {/* Item */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{order.item.emoji}</span>
        <div>
          <div className="text-xs text-slate-300 leading-snug">{order.item.name}</div>
          <div className="text-sm font-bold text-sp-gold">{order.item.price} ₡</div>
        </div>
      </div>

      {/* Actions */}
      {isPending && onApprove && onReject && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(order.id)}
            className="flex-1 bg-green-950/50 border border-green-700/30 text-green-400 rounded-lg py-1.5 text-xs font-semibold hover:bg-green-950/80 transition-colors active:scale-95"
          >
            ✓ Aprobar
          </button>
          <button
            onClick={() => onReject(order.id)}
            className="flex-1 bg-red-950/50 border border-red-700/30 text-red-400 rounded-lg py-1.5 text-xs font-semibold hover:bg-red-950/80 transition-colors active:scale-95"
          >
            ✗ Rechazar
          </button>
        </div>
      )}
    </div>
  )
}
