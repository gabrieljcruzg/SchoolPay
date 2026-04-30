'use client'

import { useState } from 'react'
import { Avatar, LevelBadge, SectionHeader } from '@/components/ui'
import { fmtCoins, getLevelProgress, LEVEL_COLORS, type Student, type QuickAction } from '@/types'

interface QuickActionsProps {
  student:  Student
  actions:  QuickAction[]
  onApply:  (action: QuickAction) => void
  onClose:  () => void
}

export function QuickActionsPanel({ student, actions, onApply, onClose }: QuickActionsProps) {
  const [customAmount, setCustomAmount] = useState('')
  const [showCustom, setShowCustom]     = useState(false)
  const { pct, toNext, nextLevel }      = getLevelProgress(student.totalEarned)
  const lc = LEVEL_COLORS[student.level]
  const earnActions = actions.filter(a => a.type === 'earn' && a.active)
  const loseActions = actions.filter(a => a.type === 'lose' && a.active)

  const handleCustom = () => {
    const n = parseInt(customAmount)
    if (isNaN(n) || n === 0) return
    onApply({
      id:     'manual',
      emoji:  n > 0 ? '✏️' : '✏️',
      label:  'Ajuste manual',
      amount: n,
      type:   n > 0 ? 'earn' : 'lose',
      active: true,
      order:  99,
    })
    setCustomAmount('')
    setShowCustom(false)
  }

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      {/* Profile card */}
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{
          background: `linear-gradient(135deg, #1e293b, #0f1f35)`,
          border: `1.5px solid ${lc}44`,
        }}
      >
        <Avatar initials={student.avatar} level={student.level} size={48} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-100 truncate">{student.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-bold text-sp-gold">{fmtCoins(student.balance)}</span>
            <LevelBadge level={student.level} />
            {student.streak >= 3 && (
              <span className="text-xs text-orange-400">🔥 {student.streak}d</span>
            )}
          </div>
          {nextLevel && (
            <div className="mt-2">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: lc }}
                />
              </div>
              <div className="text-xs text-slate-600 mt-1">{toNext} ₡ para {nextLevel}</div>
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-400 text-lg p-1">✕</button>
      </div>

      {/* Earn actions */}
      <div>
        <SectionHeader title="Ganan ₡" />
        <div className="grid grid-cols-2 gap-2">
          {earnActions.map((a) => (
            <ActionButton key={a.id} action={a} onClick={() => onApply(a)} />
          ))}
        </div>
      </div>

      {/* Lose actions */}
      <div>
        <SectionHeader title="Pierden ₡" />
        <div className="grid grid-cols-2 gap-2">
          {loseActions.map((a) => (
            <ActionButton key={a.id} action={a} onClick={() => onApply(a)} />
          ))}
        </div>
      </div>

      {/* Custom amount */}
      {!showCustom ? (
        <button
          onClick={() => setShowCustom(true)}
          className="w-full bg-white/[0.03] border border-dashed border-white/10 rounded-xl py-3 text-slate-600 text-sm hover:border-white/20 transition-colors"
        >
          ✏️ Monto personalizado
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustom()}
            placeholder="+150 ó -60"
            autoFocus
            className="input flex-1 font-mono"
          />
          <button
            onClick={handleCustom}
            className="bg-sp-bg3 border border-sp-accent/30 text-sp-accent rounded-lg px-4 text-sm font-semibold hover:bg-sp-accent/10 transition-colors"
          >
            Aplicar
          </button>
          <button
            onClick={() => setShowCustom(false)}
            className="bg-transparent border border-white/10 text-slate-600 rounded-lg px-3 text-sm"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function ActionButton({ action, onClick }: { action: QuickAction; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`${action.type === 'earn' ? 'btn-earn' : 'btn-lose'} rounded-xl p-3 flex items-center gap-2.5 text-left`}
    >
      <span className="text-xl shrink-0">{action.emoji}</span>
      <div>
        <div className="text-xs font-semibold text-slate-200 leading-tight">{action.label}</div>
        <div className={`text-sm font-bold mt-0.5 ${action.type === 'earn' ? 'text-green-400' : 'text-red-400'}`}>
          {action.amount > 0 ? '+' : ''}{action.amount} ₡
        </div>
      </div>
    </button>
  )
}
