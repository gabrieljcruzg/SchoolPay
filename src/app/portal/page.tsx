'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { signOutUser, placeOrder, subscribeToStudent, subscribeToStoreItems, subscribeToStudentOrders } from '@/lib/firestore'
import { StudentLoginForm } from '@/components/student/LoginForm'
import { BalanceHero, StoreGrid, OrderHistory } from '@/components/student/Portal'
import { ToastList, Spinner } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { type Student, type StoreItem, type PurchaseOrder } from '@/types'

const GROUP_ID = process.env.NEXT_PUBLIC_GROUP_NAME ?? '3A'

type PortalTab = 'store' | 'orders'

export default function StudentPortalPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (!user || user.role !== 'student') {
    return <StudentLoginForm onSuccess={() => {}} />
  }

  return <StudentPortal studentId={user.studentId!} groupId={GROUP_ID} />
}

function StudentPortal({ studentId, groupId }: { studentId: string; groupId: string }) {
  const [student,  setStudent]   = useState<Student | null>(null)
  const [items,    setItems]     = useState<StoreItem[]>([])
  const [orders,   setOrders]    = useState<PurchaseOrder[]>([])
  const [tab,      setTab]       = useState<PortalTab>('store')
  const { toasts, show: showToast, dismiss } = useToast()

  useEffect(() => {
    const unsubs = [
      subscribeToStudent(studentId, setStudent),
      subscribeToStoreItems(groupId, setItems),
      subscribeToStudentOrders(studentId, setOrders),
    ]
    return () => unsubs.forEach(u => u())
  }, [studentId, groupId])

  const handleBuy = async (item: StoreItem) => {
    if (!student) return
    try {
      await placeOrder(student, item)
      showToast(`Orden enviada al docente: ${item.name}`, 'ok')
    } catch (e: any) {
      showToast(e.message ?? 'Error al procesar la orden', 'err')
    }
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length

  return (
    <div className="min-h-screen bg-sp-bg">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-sp-bg2/90 backdrop-blur border-b border-white/5 px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-sp-gold to-yellow-400 rounded-lg flex items-center justify-center text-xs font-black text-yellow-950">₡</div>
          <span className="text-sm font-bold">SchoolPay</span>
        </div>
        <span className="text-xs text-slate-600">{student.name.split(',')[1]?.trim()}</span>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-5">
        {/* Balance */}
        <BalanceHero student={student} onSignOut={signOutUser} />

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {([
            ['store',  '🛒 Tienda'],
            ['orders', `📜 Mis órdenes${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all"
              style={{
                background:  tab === id ? 'rgba(232,184,75,.12)' : 'transparent',
                borderColor: tab === id ? 'rgba(232,184,75,.35)' : 'rgba(255,255,255,.07)',
                color:       tab === id ? '#e8b84b' : '#6b7280',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'store' && (
          <StoreGrid
            student={student}
            items={items}
            orders={orders}
            onBuy={handleBuy}
          />
        )}
        {tab === 'orders' && <OrderHistory orders={orders} />}
      </div>

      <ToastList toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
