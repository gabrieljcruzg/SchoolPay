'use client'

import { useState } from 'react'
import { type QuickAction, type StoreItem } from '@/types'
import { updateQuickAction, deleteQuickAction, saveQuickAction,
         updateStoreItem, saveStoreItem } from '@/lib/firestore'

interface ConfigPanelProps {
  groupId:  string
  actions:  QuickAction[]
  store:    StoreItem[]
  onToast:  (msg: string, type?: 'ok' | 'err') => void
}

type ConfigSection = 'actions' | 'store'

export function ConfigPanel({ groupId, actions, store, onToast }: ConfigPanelProps) {
  const [section, setSection] = useState<ConfigSection>('actions')

  return (
    <div>
      <div className="text-xs text-slate-700 uppercase tracking-wider mb-3">Configuración</div>
      <div className="flex gap-1.5 mb-4">
        {([['actions', '⚡ Acciones'], ['store', '🛒 Tienda']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className="flex-1 py-2 rounded-lg border text-xs font-medium transition-all"
            style={{
              background:   section === id ? 'rgba(232,184,75,0.1)' : 'transparent',
              borderColor:  section === id ? 'rgba(232,184,75,0.3)' : 'rgba(255,255,255,0.07)',
              color:        section === id ? '#e8b84b' : '#4b5563',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'actions' && (
        <ActionsConfig groupId={groupId} actions={actions} onToast={onToast} />
      )}
      {section === 'store' && (
        <StoreConfig groupId={groupId} store={store} onToast={onToast} />
      )}
    </div>
  )
}

// ─── ACTIONS CONFIG ───────────────────────────────────────────────────────────

function ActionsConfig({ groupId, actions, onToast }: {
  groupId: string; actions: QuickAction[]; onToast: (m: string, t?: 'ok'|'err') => void
}) {
  const [editing, setEditing] = useState<string | null>(null)

  const handleField = async (id: string, field: keyof QuickAction, val: string) => {
    const parsed = field === 'amount' ? parseInt(val) || 0 : val
    await updateQuickAction(id, { [field]: parsed })
  }

  const handleDelete = async (id: string) => {
    await deleteQuickAction(id)
    onToast('Acción eliminada', 'ok')
  }

  const handleAdd = async (type: 'earn' | 'lose') => {
    await saveQuickAction(groupId, {
      emoji:  type === 'earn' ? '✨' : '🔴',
      label:  'Nueva acción',
      amount: type === 'earn' ? 30 : -30,
      type,
      active: true,
      order:  actions.length,
    })
    onToast('Acción creada — edítala aquí', 'ok')
  }

  return (
    <div>
      {(['earn', 'lose'] as const).map((type) => (
        <div key={type} className="mb-4">
          <div className={`text-xs uppercase tracking-wider mb-2 ${type === 'earn' ? 'text-green-500' : 'text-red-500'}`}>
            {type === 'earn' ? '● Ganan' : '● Pierden'}
          </div>
          {actions.filter(a => a.type === type && a.active !== false).map((a) => (
            <div key={a.id} className="mb-1.5">
              {editing === a.id ? (
                <div className="bg-white/[0.03] border border-white/8 rounded-lg p-2.5 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      defaultValue={a.emoji}
                      onBlur={(e) => handleField(a.id, 'emoji', e.target.value)}
                      className="input w-10 text-center text-base px-1"
                      maxLength={2}
                    />
                    <input
                      defaultValue={a.label}
                      onBlur={(e) => handleField(a.id, 'label', e.target.value)}
                      className="input flex-1 text-xs"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      defaultValue={Math.abs(a.amount)}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value) || 0
                        handleField(a.id, 'amount', String(type === 'earn' ? n : -n))
                      }}
                      className="input w-16 text-sm font-mono"
                    />
                    <span className="text-xs text-slate-600">₡</span>
                    <button
                      onClick={() => setEditing(null)}
                      className="flex-1 bg-sp-gold/10 border border-sp-gold/30 text-sp-gold rounded-md py-1 text-xs font-semibold"
                    >
                      Listo
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="bg-red-950/30 border border-red-800/30 text-red-400 rounded-md px-2 py-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditing(a.id)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer hover:border-white/10 transition-colors"
                >
                  <span className="text-base">{a.emoji}</span>
                  <span className="flex-1 text-xs text-slate-300 truncate">{a.label}</span>
                  <span className={`text-xs font-bold ${type === 'earn' ? 'text-green-400' : 'text-red-400'}`}>
                    {a.amount > 0 ? '+' : ''}{a.amount}₡
                  </span>
                  <span className="text-slate-700 text-xs">✏️</span>
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() => handleAdd(type)}
            className="w-full border border-dashed rounded-lg py-1.5 text-xs mt-1 transition-colors"
            style={{
              borderColor: type === 'earn' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)',
              color:        type === 'earn' ? '#4ade80' : '#f87171',
            }}
          >
            + Agregar
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── STORE CONFIG ─────────────────────────────────────────────────────────────

function StoreConfig({ groupId, store, onToast }: {
  groupId: string; store: StoreItem[]; onToast: (m: string, t?: 'ok'|'err') => void
}) {
  const [editing, setEditing] = useState<string | null>(null)

  const handleField = async (id: string, field: keyof StoreItem, val: string) => {
    const parsed = (field === 'price' || field === 'stock') ? parseInt(val) || 0 : val
    await updateStoreItem(id, { [field]: parsed })
  }

  const handleAdd = async () => {
    await saveStoreItem(groupId, {
      emoji:            '🎁',
      name:             'Nueva recompensa',
      price:            100,
      stock:            1,
      maxPerStudent:    1,
      category:         'daily',
      active:           true,
      requiresApproval: true,
    })
    onToast('Recompensa creada', 'ok')
  }

  return (
    <div>
      <div className="text-xs text-slate-700 mb-2">Toca cualquier item para editar</div>
      {store.map((item) => (
        <div key={item.id} className="mb-1.5">
          {editing === item.id ? (
            <div className="bg-white/[0.03] border border-white/8 rounded-lg p-2.5 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  defaultValue={item.emoji}
                  onBlur={(e) => handleField(item.id, 'emoji', e.target.value)}
                  className="input w-10 text-center text-base px-1"
                  maxLength={2}
                />
                <input
                  defaultValue={item.name}
                  onBlur={(e) => handleField(item.id, 'name', e.target.value)}
                  className="input flex-1 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs text-slate-600">Precio</span>
                  <input
                    type="number"
                    defaultValue={item.price}
                    onBlur={(e) => handleField(item.id, 'price', e.target.value)}
                    className="input flex-1 text-xs font-mono"
                  />
                  <span className="text-xs text-slate-600">₡</span>
                </div>
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs text-slate-600">Stock</span>
                  <input
                    type="number"
                    defaultValue={item.stock}
                    onBlur={(e) => handleField(item.id, 'stock', e.target.value)}
                    className="input flex-1 text-xs font-mono"
                  />
                </div>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="bg-sp-gold/10 border border-sp-gold/30 text-sp-gold rounded-md py-1.5 text-xs font-semibold"
              >
                Listo
              </button>
            </div>
          ) : (
            <div
              onClick={() => setEditing(item.id)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer hover:border-white/10 transition-colors"
            >
              <span className="text-base">{item.emoji}</span>
              <span className="flex-1 text-xs text-slate-300 truncate">{item.name}</span>
              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-sp-gold">{item.price}₡</div>
                <div className="text-xs text-slate-700">×{item.stock}</div>
              </div>
              <span className="text-slate-700 text-xs">✏️</span>
            </div>
          )}
        </div>
      ))}
      <button
        onClick={handleAdd}
        className="w-full border border-dashed border-sp-gold/20 text-sp-gold rounded-lg py-2 text-xs mt-1 hover:border-sp-gold/40 transition-colors"
      >
        + Nueva recompensa
      </button>
    </div>
  )
}
