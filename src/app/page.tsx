'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { teacherSignIn, signOutUser } from '@/lib/firestore'
import {
  subscribeToStudents, subscribeToOrders, subscribeToTransactions,
  subscribeToQuickActions, subscribeToStoreItems,
  addTransaction, resolveOrder,
} from '@/lib/firestore'
import { useNFC } from '@/hooks/useNFC'
import { useToast } from '@/hooks/useToast'
import { QuickActionsPanel } from '@/components/teacher/QuickActionsPanel'
import { OrdersPanel } from '@/components/teacher/OrdersPanel'
import { ConfigPanel } from '@/components/teacher/ConfigPanel'
import { Avatar, LevelBadge, NFCButton, ToastList, Spinner, EmptyState, SectionHeader } from '@/components/ui'
import { fmtCoins, type Student, type QuickAction, type PurchaseOrder, type Transaction } from '@/types'
import Link from 'next/link'

const GROUP_ID = process.env.NEXT_PUBLIC_GROUP_NAME ?? '3A'

type TeacherTab = 'panel' | 'orders' | 'config'

export default function TeacherPage() {
  const { user, loading, isTeacher } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (!user || !isTeacher) {
    // No hay sesión de docente — muestra login
    return <TeacherLogin />
  }

  return <TeacherDashboard teacherId={user.uid} groupId={GROUP_ID} />
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

function TeacherLogin() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      await teacherSignIn()
    } catch (e: any) {
      setError(e.message ?? 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5"
      style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(232,184,75,.06) 0%, transparent 70%)' }}>
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-sp-gold to-yellow-400 rounded-2xl inline-flex items-center justify-center text-3xl font-black text-yellow-950 mb-4">
          ₡
        </div>
        <h1 className="text-2xl font-bold mb-1">SchoolPay</h1>
        <p className="text-sm text-slate-600 mb-8">Panel del Docente</p>

        <div className="card mb-4">
          <p className="text-sm text-slate-400 mb-5">
            Inicia sesión con la cuenta de Google registrada como docente en el sistema.
          </p>
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-semibold py-3 rounded-xl hover:bg-slate-100 transition-colors active:scale-95 disabled:opacity-50"
          >
            {loading ? <Spinner size={18} /> : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continuar con Google
          </button>
        </div>
        <p className="text-xs text-slate-700">
          Solo funciona con el email registrado como docente en el sistema
        </p>
      </div>
    </div>
  )
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function TeacherDashboard({ teacherId, groupId }: { teacherId: string; groupId: string }) {
  const [students,  setStudents]  = useState<Student[]>([])
  const [orders,    setOrders]    = useState<PurchaseOrder[]>([])
  const [txLog,     setTxLog]     = useState<Transaction[]>([])
  const [actions,   setActions]   = useState<QuickAction[]>([])
  const [storeItems, setStoreItems] = useState<any[]>([])
  const [selected,  setSelected]  = useState<string | null>(null)
  const [tab,       setTab]       = useState<TeacherTab>('panel')
  const { toasts, show: showToast, dismiss } = useToast()

  // Suscripciones en tiempo real
  useEffect(() => {
    const unsubs = [
      subscribeToStudents(groupId, setStudents),
      subscribeToOrders(groupId, setOrders),
      subscribeToTransactions(groupId, 20, setTxLog),
      subscribeToQuickActions(groupId, setActions),
      subscribeToStoreItems(groupId, setStoreItems),
    ]
    return () => unsubs.forEach(u => u())
  }, [groupId])

  // NFC
  const handleNFCRead = useCallback((studentId: string) => {
    const found = students.find(s => s.id === studentId)
    if (found) {
      setSelected(studentId)
      setTab('panel')
    } else {
      showToast(`ID "${studentId}" no encontrado en el grupo`, 'err')
    }
  }, [students, showToast])

  const { status: nfcStatus, startScan, stopScan, supported: nfcSupported, submitManual } = useNFC({
    onRead: handleNFCRead,
  })

  const [manualId, setManualId]   = useState('')
  const [showManual, setShowManual] = useState(false)

  const handleApplyAction = async (action: QuickAction) => {
    if (!selected) return
    const student = students.find(s => s.id === selected)
    if (!student) return

    const txId = await addTransaction({
      studentId: selected,
      amount:    action.amount,
      type:      'manual',
      label:     action.label,
      teacherId,
    })
    showToast(
      `${action.amount > 0 ? '+' : ''}${action.amount} ₡ → ${student.name.split(',')[0]} · ${action.label}`,
      'ok',
      () => {
        // La función de deshacer revierte la transacción
        import('@/lib/firestore').then(({ reverseTransaction }) =>
          reverseTransaction(txId, teacherId)
        )
      },
    )
  }

  const handleResolveOrder = async (orderId: string, approved: boolean) => {
    await resolveOrder(orderId, approved ? 'approved' : 'rejected', teacherId)
    showToast(approved ? '✓ Recompensa aprobada' : 'Orden rechazada — saldo devuelto', approved ? 'ok' : 'err')
  }

  const pendingOrders = orders.filter(o => o.status === 'pending').length
  const selectedStudent = selected ? students.find(s => s.id === selected) : null

  return (
    <div className="flex flex-col h-screen bg-sp-bg">
      {/* Top nav */}
      <nav className="bg-sp-bg2 border-b border-white/5 px-4 flex items-center justify-between h-14 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-sp-gold to-yellow-400 rounded-lg flex items-center justify-center text-xs font-black text-yellow-950">₡</div>
          <span className="font-bold text-sm">{process.env.NEXT_PUBLIC_SCHOOL_NAME ?? 'SchoolPay'}</span>
          <span className="text-xs text-slate-700 border-l border-white/8 pl-2.5">{groupId}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/students"
            className="text-xs px-3 py-1.5 rounded-lg border border-white/8 text-slate-500 hover:border-white/20 hover:text-slate-300 transition-colors"
          >
            👥 Alumnos
          </Link>
          <button onClick={signOutUser} className="text-xs text-slate-700 hover:text-slate-500 transition-colors px-2">
            Salir
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 border-r border-white/5 bg-sp-bg2/50 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/5 shrink-0">
            {([
              ['panel',  'Panel'],
              ['orders', `Órdenes${pendingOrders > 0 ? ` (${pendingOrders})` : ''}`],
              ['config', '⚙️'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 py-2.5 text-xs font-medium transition-all border-b-2"
                style={{
                  color:        tab === id ? '#e8b84b' : '#4b5563',
                  borderColor:  tab === id ? '#e8b84b' : 'transparent',
                  background:   'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 p-3">
            {/* PANEL TAB */}
            {tab === 'panel' && (
              <>
                <div className="text-xs text-slate-700 uppercase tracking-wider mb-2.5">Alumnos · {students.length}</div>
                {students.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelected(s.id === selected ? null : s.id)}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer mb-1 transition-all"
                    style={{
                      background:  selected === s.id ? 'rgba(232,184,75,.08)' : 'transparent',
                      border:      `1px solid ${selected === s.id ? 'rgba(232,184,75,.2)' : 'transparent'}`,
                    }}
                  >
                    <Avatar initials={s.avatar} level={s.level} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {s.name.split(',')[1]?.trim()} {s.name.split(',')[0]}
                      </div>
                      <div className="text-xs text-sp-gold font-semibold">{fmtCoins(s.balance)}</div>
                    </div>
                    {s.streak >= 5 && <span className="text-xs">🔥</span>}
                  </div>
                ))}

                {/* Recent transactions */}
                <div className="mt-4 border-t border-white/5 pt-4">
                  <SectionHeader title="Recientes" />
                  {txLog.length === 0 && <p className="text-xs text-slate-700 px-1">Sin movimientos</p>}
                  {txLog.slice(0, 10).map((tx) => {
                    const s = students.find(x => x.id === tx.studentId)
                    return (
                      <div key={tx.id} className="flex justify-between text-xs py-1 border-b border-white/[0.04]">
                        <span className="text-slate-600 truncate max-w-[120px]">
                          {s?.name?.split(',')[0]} · {tx.label}
                        </span>
                        <span className={`font-bold ml-2 shrink-0 ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}₡
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* ORDERS TAB */}
            {tab === 'orders' && (
              <OrdersPanel
                orders={orders}
                onApprove={(id) => handleResolveOrder(id, true)}
                onReject={(id) => handleResolveOrder(id, false)}
              />
            )}

            {/* CONFIG TAB */}
            {tab === 'config' && (
              <ConfigPanel
                groupId={groupId}
                actions={actions}
                store={storeItems}
                onToast={showToast}
              />
            )}
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 overflow-y-auto p-5">
          <div className="max-w-lg mx-auto">

            {/* NFC Scanner */}
            {!selectedStudent && (
              <div className="mb-6">
                <NFCButton status={nfcStatus} onStart={startScan} onStop={stopScan} />

                {!nfcSupported && (
                  <p className="text-xs text-center text-slate-700 mt-2">
                    Tu dispositivo no soporta NFC — usa el modo manual
                  </p>
                )}

                {/* Manual fallback */}
                <div className="mt-3">
                  {!showManual ? (
                    <button
                      onClick={() => setShowManual(true)}
                      className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-2"
                    >
                      ↳ Ingresar ID manualmente
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value.toUpperCase())}
                        onKeyDown={(e) => { if (e.key === 'Enter') { submitManual(manualId); setShowManual(false); setManualId('') } }}
                        placeholder="Ej: 3A-017"
                        autoFocus
                        className="input flex-1 font-mono text-sm uppercase"
                      />
                      <button
                        onClick={() => { submitManual(manualId); setShowManual(false); setManualId('') }}
                        className="bg-sp-bg3 border border-white/10 text-slate-300 rounded-lg px-4 text-sm"
                      >
                        Buscar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quick actions (when student selected) */}
            {selectedStudent ? (
              <QuickActionsPanel
                student={selectedStudent}
                actions={actions}
                onApply={handleApplyAction}
                onClose={() => setSelected(null)}
              />
            ) : (
              <EmptyState
                emoji="📡"
                title="Selecciona un alumno"
                description={nfcSupported ? 'Acerca la tarjeta NFC al celular, o selecciona un alumno de la lista' : 'Selecciona un alumno de la lista o ingresa su ID manualmente'}
              />
            )}
          </div>
        </main>
      </div>

      <ToastList toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
