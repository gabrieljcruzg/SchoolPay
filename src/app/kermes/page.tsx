'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/lib/auth'
import {
  chargeKermesCard,
  closeKermes,
  createKermesAccessAccount,
  createKermesCard,
  createKermesProduct,
  createKermesVendor,
  deleteKermesAccess,
  deleteKermesCard,
  deleteKermesProduct,
  deleteKermesVendor,
  kermesAccessSignIn,
  rechargeKermesCard,
  signOutUser,
  subscribeToAllKermesTransactions,
  subscribeToKermesAccess,
  subscribeToKermesCards,
  subscribeToKermesHistory,
  subscribeToKermesProducts,
  subscribeToKermesSession,
  subscribeToKermesTransactions,
  subscribeToKermesVendors,
  updateKermesAccess,
  updateKermesProduct,
} from '@/lib/firestore'
import { useNFC, writeNFCTag } from '@/hooks/useNFC'
import { Spinner, ToastList } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import {
  fmtCoins,
  type AuthUser,
  type KermesAccess,
  type KermesCard,
  type KermesHistoryEvent,
  type KermesProduct,
  type KermesTransaction,
  type KermesVendor,
} from '@/types'

type KermesTab = 'pos' | 'dashboard' | 'cards' | 'vendors' | 'access' | 'history'

type Receipt = {
  type: 'charge' | 'recharge'
  amount: number
  balance: number
  cardId: string
  vendorName?: string
}

type PrintSummaryData = {
  totalBank: number
  totalSales: number
  remainingBalance: number
  salesByVendor: { vendorId: string; vendorName: string; total: number; count: number }[]
  totalCards: number
  totalRecharges: number
  totalPurchases: number
  cards: { id: string; label: string; balance: number }[]
  closedAt: Date
}

export default function KermesPage() {
  const { user, loading, isTeacher, isKermesTerminal } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user?.role === 'student') router.replace('/')
  }, [loading, user?.role, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size={32} /></div>
  }

  if (!user || (!isTeacher && !isKermesTerminal)) {
    return <KermesAccessLogin />
  }

  return <KermesManager user={user} isTeacher={isTeacher} />
}

function KermesManager({ user, isTeacher }: { user: AuthUser; isTeacher: boolean }) {
  const [cards, setCards] = useState<KermesCard[]>([])
  const [vendors, setVendors] = useState<KermesVendor[]>([])
  const [products, setProducts] = useState<KermesProduct[]>([])
  const [txs, setTxs] = useState<KermesTransaction[]>([])
  const [dashboardTxs, setDashboardTxs] = useState<KermesTransaction[]>([])
  const [accessList, setAccessList] = useState<KermesAccess[]>([])
  const [historyEvents, setHistoryEvents] = useState<KermesHistoryEvent[]>([])
  const [sessionStart, setSessionStart] = useState<Date | null | undefined>(undefined)
  const [tab, setTab] = useState<KermesTab>('pos')
  const [selectedCardId, setSelectedCardId] = useState('')
  const [manualId, setManualId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [printSummary, setPrintSummary] = useState<PrintSummaryData | null>(null)
  const { toasts, show: showToast, dismiss } = useToast()
  const canCharge = isTeacher || user.role === 'kermes_vendor'
  const canRecharge = isTeacher || user.role === 'kermes_bank'
  const visibleTabs: { id: KermesTab; label: string }[] = [
    { id: 'pos', label: canRecharge && !canCharge ? 'Recargar' : 'Cobrar' },
    ...(isTeacher ? [
      { id: 'dashboard' as KermesTab, label: 'Dashboard' },
      { id: 'cards' as KermesTab, label: 'Tarjetas' },
      { id: 'vendors' as KermesTab, label: 'Tiendas' },
      { id: 'access' as KermesTab, label: 'Accesos' },
      { id: 'history' as KermesTab, label: 'Historial' },
    ] : []),
  ]

  useEffect(() => {
    return subscribeToKermesSession(setSessionStart)
  }, [])

  useEffect(() => {
    if (sessionStart === undefined) return
    const unsubs = [
      subscribeToKermesCards(setCards),
      subscribeToKermesVendors(setVendors),
    ]
    if (isTeacher) {
      unsubs.push(subscribeToKermesTransactions(sessionStart, setTxs))
      unsubs.push(subscribeToAllKermesTransactions(sessionStart, setDashboardTxs))
      unsubs.push(subscribeToKermesAccess(setAccessList))
      unsubs.push(subscribeToKermesHistory(setHistoryEvents))
    }
    return () => unsubs.forEach(u => u())
  }, [isTeacher, sessionStart])

  useEffect(() => {
    if (!isTeacher && tab !== 'pos') setTab('pos')
  }, [isTeacher, tab])

  useEffect(() => {
    if (user.role === 'kermes_vendor' && user.kermesVendorId) {
      setVendorId(user.kermesVendorId)
      return
    }
    if (!vendorId && vendors[0]) setVendorId(vendors[0].id)
  }, [user.role, user.kermesVendorId, vendorId, vendors])

  useEffect(() => {
    if (!vendorId || !canCharge) {
      setProducts([])
      setCart({})
      return
    }
    setCart({})
    return subscribeToKermesProducts(vendorId, setProducts)
  }, [canCharge, vendorId])

  const handleRead = useCallback((id: string) => {
    setSelectedCardId(id)
    setManualId(id)
    setTab('pos')
  }, [])

  const { status, startScan, stopScan, supported, submitManual } = useNFC({ onRead: handleRead })
  const selectedCard = cards.find(card => card.id === selectedCardId)
  const selectedVendor = vendors.find(vendor => vendor.id === vendorId)
  const cartItems = products
    .map(product => ({ product, qty: cart[product.id] ?? 0 }))
    .filter(item => item.qty > 0)
  const cartTotal = cartItems.reduce((sum, item) => sum + item.product.price * item.qty, 0)

  const parsedAmount = canCharge ? cartTotal || Number(amount) : Number(amount)

  const addProduct = (product: KermesProduct) => {
    setCart(prev => ({ ...prev, [product.id]: (prev[product.id] ?? 0) + 1 }))
  }

  const decrementProduct = (productId: string) => {
    setCart(prev => {
      const nextQty = (prev[productId] ?? 0) - 1
      const next = { ...prev }
      if (nextQty <= 0) delete next[productId]
      else next[productId] = nextQty
      return next
    })
  }

  const handleCharge = async () => {
    if (!selectedCardId || !selectedVendor) return
    setBusy(true)
    try {
      const items = cartItems.map(({ product, qty }) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        qty,
      }))
      const txNote = note.trim() || (items.length ? items.map(item => `${item.qty}x ${item.name}`).join(', ') : undefined)
      const updatedCard = await chargeKermesCard(selectedCardId, selectedVendor, parsedAmount, user.uid, txNote, items)
      setReceipt({
        type: 'charge',
        amount: parsedAmount,
        balance: updatedCard.balance,
        cardId: updatedCard.id,
        vendorName: selectedVendor.name,
      })
      showToast(`Cobro aplicado: ${fmtCoins(parsedAmount)} · ${selectedVendor.name}`, 'ok')
      setAmount('')
      setNote('')
      setCart({})
    } catch (e: any) {
      showToast(e.message ?? 'No se pudo cobrar', 'err')
    } finally {
      setBusy(false)
    }
  }

  const handleRecharge = async () => {
    if (!selectedCardId) return
    setBusy(true)
    try {
      const updatedCard = await rechargeKermesCard(selectedCardId, parsedAmount, user.uid, note.trim() || undefined)
      setReceipt({
        type: 'recharge',
        amount: parsedAmount,
        balance: updatedCard.balance,
        cardId: updatedCard.id,
      })
      showToast(`Recarga aplicada: ${fmtCoins(parsedAmount)}`, 'ok')
      setAmount('')
      setNote('')
    } catch (e: any) {
      showToast(e.message ?? 'No se pudo recargar', 'err')
    } finally {
      setBusy(false)
    }
  }

  const buildSummary = (): PrintSummaryData => {
    const purchases = dashboardTxs.filter(tx => tx.type === 'purchase')
    const recharges = dashboardTxs.filter(tx => tx.type === 'recharge')
    const totalBank = recharges.reduce((sum, tx) => sum + tx.amount, 0)
    const totalSales = purchases.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    const remainingBalance = cards.reduce((sum, c) => sum + c.balance, 0)
    const salesByVendor = vendors
      .map(vendor => {
        const vtxs = purchases.filter(tx => tx.vendorId === vendor.id)
        return { vendorId: vendor.id, vendorName: vendor.name, total: vtxs.reduce((s, tx) => s + Math.abs(tx.amount), 0), count: vtxs.length }
      })
      .sort((a, b) => b.total - a.total)
    return {
      totalBank,
      totalSales,
      remainingBalance,
      salesByVendor,
      totalCards: cards.length,
      totalRecharges: recharges.length,
      totalPurchases: purchases.length,
      cards: cards.map(c => ({ id: c.id, label: c.label, balance: c.balance })),
      closedAt: new Date(),
    }
  }

  const handleOpenCloseModal = () => {
    setPrintSummary(buildSummary())
    setShowCloseModal(true)
  }

  const handleCloseKermes = async () => {
    if (!printSummary) return
    setBusy(true)
    try {
      await closeKermes({
        summary: {
          totalBank: printSummary.totalBank,
          totalSales: printSummary.totalSales,
          remainingBalance: printSummary.remainingBalance,
          salesByVendor: printSummary.salesByVendor,
          totalCards: printSummary.totalCards,
          totalRecharges: printSummary.totalRecharges,
          totalPurchases: printSummary.totalPurchases,
        },
        cards: printSummary.cards,
        sessionStart: sessionStart ?? null,
      })
      setShowCloseModal(false)
      setTab('dashboard')
      showToast('Kermés cerrada y guardada en historial', 'ok')
    } catch (e: any) {
      showToast(e.message ?? 'No se pudo cerrar la kermés', 'err')
    } finally {
      setBusy(false)
    }
  }

  if (sessionStart === undefined) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size={32} /></div>
  }

  return (
    <div className="min-h-screen bg-sp-bg">
      {printSummary && <KermesPrintArea summary={printSummary} />}

      <nav className="bg-sp-bg2 border-b border-white/5 px-4 h-14 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">← Panel</Link>
        <span className="text-white/10">|</span>
        <span className="font-semibold text-sm">Modo Kermés</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-slate-600">
            {isTeacher ? 'Administrador' : `${user.kermesAccessName ?? 'Terminal'} · ${user.role === 'kermes_bank' ? 'Banco' : 'Tienda'}`}
          </span>
          <button onClick={signOutUser} className="text-xs text-slate-700 hover:text-slate-500 transition-colors px-2">Salir</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-5 overflow-x-auto">
          {visibleTabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg border text-sm font-semibold shrink-0 ${tab === id ? 'border-sp-gold/40 bg-sp-gold/10 text-sp-gold' : 'border-white/10 text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'pos' && (
          <section className="grid md:grid-cols-[1fr_320px] gap-4">
            <div className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
              <h1 className="text-lg font-bold mb-4">{canCharge && canRecharge ? 'Cobro y recarga' : canRecharge ? 'Banco' : 'Punto de venta'}</h1>
              <button
                onClick={status === 'scanning' ? stopScan : startScan}
                className="w-full bg-sp-gold/15 border border-sp-gold/30 text-sp-gold rounded-xl py-4 font-semibold mb-3"
              >
                {status === 'scanning' ? 'Esperando tarjeta... tocar para cancelar' : 'Leer tarjeta NFC'}
              </button>
              {!supported && <p className="text-xs text-slate-600 text-center mb-3">Este dispositivo no soporta NFC. Usa ID manual.</p>}
              <div className="flex gap-2 mb-4">
                <input
                  value={manualId}
                  onChange={e => setManualId(e.target.value.toUpperCase())}
                  placeholder="K-ABC12345"
                  className="input flex-1 font-mono"
                />
                <button
                  onClick={() => submitManual(manualId)}
                  className="px-4 rounded-lg border border-white/10 text-slate-300"
                >
                  Buscar
                </button>
              </div>

              {selectedCard ? (
                <div className="rounded-xl bg-sp-bg3 p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500">{selectedCard.id}</div>
                      <div className="font-semibold">{selectedCard.label}</div>
                    </div>
                    <div className="text-2xl font-black text-sp-gold">{fmtCoins(selectedCard.balance)}</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-600 mb-4">
                  Lee o ingresa una tarjeta para operar.
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                {canCharge ? (
                  <div>
                    <label className="text-xs text-slate-600 block mb-1.5">Tienda</label>
                    <select
                      value={vendorId}
                      onChange={e => setVendorId(e.target.value)}
                      className="input disabled:opacity-70"
                      disabled={user.role === 'kermes_vendor' && !isTeacher}
                    >
                      {vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-slate-600 block mb-1.5">Operación</label>
                    <input value="Banco" readOnly className="input opacity-70" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-600 block mb-1.5">Monto</label>
                  <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))} className="input font-mono" placeholder="Opcional" disabled={cartTotal > 0} />
                </div>
              </div>

              {canCharge && <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold">Productos</h2>
                  <span className="text-xs text-slate-600">{products.length} activos</span>
                </div>
                {products.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-600">
                    Agrega productos en la pestaña Tiendas para usar el punto de venta.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {products.map(product => (
                      <button
                        key={product.id}
                        onClick={() => addProduct(product)}
                        className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-left hover:border-sp-gold/30 active:scale-[0.98] transition-all"
                      >
                        <div className="text-sm font-semibold text-slate-200 leading-tight">{product.name}</div>
                        <div className="text-lg font-black text-sp-gold mt-2">{fmtCoins(product.price)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>}

              {canCharge && cartItems.length > 0 && (
                <div className="rounded-xl bg-sp-bg3 border border-white/5 p-3 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-semibold">Cuenta</h2>
                    <button onClick={() => setCart({})} className="text-xs text-slate-500">Limpiar</button>
                  </div>
                  <div className="space-y-1">
                    {cartItems.map(({ product, qty }) => (
                      <div key={product.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 text-sm">
                        <button onClick={() => decrementProduct(product.id)} className="w-7 h-7 rounded-md border border-white/10 text-slate-400">-</button>
                        <span className="text-slate-300 truncate">{qty}x {product.name}</span>
                        <span className="font-mono text-xs text-slate-500">{fmtCoins(product.price * qty)}</span>
                        <button onClick={() => addProduct(product)} className="w-7 h-7 rounded-md border border-white/10 text-slate-400">+</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-t border-white/5 mt-3 pt-3">
                    <span className="text-sm text-slate-500">Total</span>
                    <span className="text-2xl font-black text-sp-gold">{fmtCoins(cartTotal)}</span>
                  </div>
                </div>
              )}

              <input value={note} onChange={e => setNote(e.target.value)} className="input mt-3" placeholder="Nota opcional" />
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {canCharge && (
                  <button disabled={!selectedCard || !parsedAmount || busy} onClick={handleCharge} className="bg-red-950/40 border border-red-700/30 text-red-300 rounded-lg py-3 font-semibold disabled:opacity-40">
                    Cobrar
                  </button>
                )}
                {canRecharge && (
                  <button disabled={!selectedCard || !parsedAmount || busy} onClick={handleRecharge} className="bg-green-950/40 border border-green-700/30 text-green-300 rounded-lg py-3 font-semibold disabled:opacity-40">
                    Recargar
                  </button>
                )}
              </div>
            </div>

            <KermesCardList cards={cards} onSelect={card => { setSelectedCardId(card.id); setManualId(card.id) }} />
          </section>
        )}

        {tab === 'dashboard' && (
          <KermesDashboard
            txs={dashboardTxs}
            vendors={vendors}
            cards={cards}
            historyEvents={historyEvents}
            onOpenClose={handleOpenCloseModal}
          />
        )}
        {tab === 'cards' && <KermesCardsAdmin cards={cards} onToast={showToast} />}
        {tab === 'vendors' && <KermesVendorsAdmin vendors={vendors} selectedVendorId={vendorId} onSelectVendor={setVendorId} products={products} onToast={showToast} />}
        {tab === 'access' && <KermesAccessAdmin accessList={accessList} vendors={vendors} onToast={showToast} />}
        {tab === 'history' && <KermesHistory txs={txs} />}
      </main>

      {receipt && <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />}
      {showCloseModal && printSummary && (
        <CloseKermesModal
          summary={printSummary}
          busy={busy}
          onClose={() => setShowCloseModal(false)}
          onConfirm={handleCloseKermes}
        />
      )}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// ─── PRINT AREA ───────────────────────────────────────────────────────────────

function KermesPrintArea({ summary }: { summary: PrintSummaryData }) {
  return (
    <>
      <style>{`
        #kermes-print-area { display: none; }
        @media print {
          body * { visibility: hidden; }
          #kermes-print-area, #kermes-print-area * { visibility: visible; }
          #kermes-print-area {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background: white;
            color: black;
            padding: 2cm;
            font-family: sans-serif;
          }
          @page { margin: 1.5cm; }
        }
      `}</style>
      <div id="kermes-print-area">
        <div style={{ borderBottom: '2px solid #333', paddingBottom: '12px', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Resumen de Kermés</h1>
          <p style={{ color: '#555', margin: '4px 0 0' }}>
            Fecha de cierre: {format(summary.closedAt, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ingresado al banco</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>{fmtCoins(summary.totalBank)}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{summary.totalRecharges} recarga{summary.totalRecharges !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total vendido</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>{fmtCoins(summary.totalSales)}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{summary.totalPurchases} cobro{summary.totalPurchases !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo sin gastar</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>{fmtCoins(summary.remainingBalance)}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{summary.totalCards} tarjeta{summary.totalCards !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {summary.salesByVendor.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>Ventas por tienda</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px' }}>Tienda</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Cobros</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px' }}>Total vendido</th>
                </tr>
              </thead>
              <tbody>
                {summary.salesByVendor.map(v => (
                  <tr key={v.vendorId} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 8px' }}>{v.vendorName}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{v.count}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 'bold' }}>{fmtCoins(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {summary.cards.length > 0 && (
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>
              Saldos por tarjeta al cierre
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #333' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Etiqueta</th>
                  <th style={{ textAlign: 'right', padding: '4px 8px' }}>Saldo restante</th>
                </tr>
              </thead>
              <tbody>
                {summary.cards.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{c.id}</td>
                    <td style={{ padding: '4px 8px' }}>{c.label}</td>
                    <td style={{ textAlign: 'right', padding: '4px 8px' }}>{fmtCoins(c.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ─── CLOSE KERMES MODAL ───────────────────────────────────────────────────────

function CloseKermesModal({
  summary,
  busy,
  onClose,
  onConfirm,
}: {
  summary: PrintSummaryData
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-sp-bg2 border border-white/10 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-red-300">Cerrar Kermés</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
        </div>

        {step === 1 ? (
          <>
            <p className="text-sm text-slate-400 mb-4">
              Revisa el resumen final. Al cerrar, todas las tarjetas quedarán inactivas y se guardará todo como historial para comenzar desde cero.
            </p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-green-950/30 border border-green-700/20 p-3 text-center">
                <div className="text-xs text-green-400/70 mb-1">Banco</div>
                <div className="text-lg font-black text-green-300">{fmtCoins(summary.totalBank)}</div>
                <div className="text-xs text-slate-600">{summary.totalRecharges} recargas</div>
              </div>
              <div className="rounded-xl bg-red-950/30 border border-red-700/20 p-3 text-center">
                <div className="text-xs text-red-400/70 mb-1">Vendido</div>
                <div className="text-lg font-black text-red-300">{fmtCoins(summary.totalSales)}</div>
                <div className="text-xs text-slate-600">{summary.totalPurchases} cobros</div>
              </div>
              <div className="rounded-xl bg-sp-gold/5 border border-sp-gold/20 p-3 text-center">
                <div className="text-xs text-sp-gold/70 mb-1">Sin gastar</div>
                <div className="text-lg font-black text-sp-gold">{fmtCoins(summary.remainingBalance)}</div>
                <div className="text-xs text-slate-600">{summary.totalCards} tarjetas</div>
              </div>
            </div>

            {summary.salesByVendor.length > 0 && (
              <div className="rounded-xl bg-sp-bg3 border border-white/5 p-3 mb-4 max-h-36 overflow-auto">
                <div className="text-xs text-slate-500 mb-2 font-semibold">Ventas por tienda</div>
                {summary.salesByVendor.map(v => (
                  <div key={v.vendorId} className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0">
                    <span className="text-slate-300">{v.vendorName}</span>
                    <span className="font-bold text-sp-gold">{fmtCoins(v.total)}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handlePrint}
              className="w-full mb-3 rounded-xl border border-sp-gold/30 bg-sp-gold/10 text-sp-gold py-2.5 text-sm font-semibold"
            >
              Imprimir / Guardar como PDF
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClose} className="rounded-xl border border-white/10 text-slate-400 py-3 font-semibold text-sm">
                Cancelar
              </button>
              <button
                onClick={() => setStep(2)}
                className="rounded-xl bg-red-950/50 border border-red-700/30 text-red-300 py-3 font-semibold text-sm"
              >
                Cerrar kermés →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-red-950/30 border border-red-700/30 p-4 mb-5">
              <p className="text-red-300 font-semibold text-sm mb-1">Esta acción no se puede deshacer</p>
              <p className="text-red-400/70 text-xs">
                Se archivarán {summary.totalCards} tarjeta{summary.totalCards !== 1 ? 's' : ''} y todas las transacciones de esta sesión quedarán guardadas en el historial.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setStep(1)} className="rounded-xl border border-white/10 text-slate-400 py-3 font-semibold text-sm">
                Volver
              </button>
              <button
                onClick={onConfirm}
                disabled={busy}
                className="rounded-xl bg-red-800/60 border border-red-600/40 text-red-200 py-3 font-bold text-sm disabled:opacity-40"
              >
                {busy ? 'Cerrando...' : 'CONFIRMAR CIERRE'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── ACCESS LOGIN ─────────────────────────────────────────────────────────────

function KermesAccessLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await kermesAccessSignIn(email, password)
    } catch {
      setError('No se pudo iniciar sesión con esta cuenta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-sp-bg flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-sp-bg2 border border-white/10 p-5">
        <Link href="/" className="text-xs text-slate-600 hover:text-slate-400">← Volver</Link>
        <h1 className="text-xl font-bold mt-5 mb-1">Acceso Kermés</h1>
        <p className="text-sm text-slate-600 mb-5">Entra con la cuenta asignada a este celular.</p>
        <label className="text-xs text-slate-600 block mb-1.5">Usuario</label>
        <div className="flex mb-3">
          <input value={email} onChange={e => setEmail(e.target.value)} className="input rounded-r-none font-mono" autoComplete="username" placeholder="banco.1" />
          <span className="hidden sm:flex items-center rounded-r-lg border border-l-0 border-white/10 bg-sp-bg3 px-3 text-xs text-slate-600">@kermes.schoolpay.local</span>
        </div>
        <label className="text-xs text-slate-600 block mb-1.5">Contraseña</label>
        <input value={password} onChange={e => setPassword(e.target.value)} className="input mb-4" type="password" autoComplete="current-password" />
        {error && <div className="rounded-lg bg-red-950/40 border border-red-700/30 text-red-300 text-sm p-3 mb-3">{error}</div>}
        <button disabled={busy || !email || !password} className="w-full bg-sp-gold/15 border border-sp-gold/30 text-sp-gold rounded-xl py-3 font-semibold disabled:opacity-40">
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}

// ─── ACCESS ADMIN ─────────────────────────────────────────────────────────────

function KermesAccessAdmin({
  accessList,
  vendors,
  onToast,
}: {
  accessList: KermesAccess[]
  vendors: KermesVendor[]
  onToast: (msg: string, type?: 'ok' | 'err') => void
}) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<'vendor' | 'bank'>('vendor')
  const [vendorId, setVendorId] = useState('')
  const [lastAccount, setLastAccount] = useState<{ email: string; password: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const selectedVendor = vendors.find(vendor => vendor.id === vendorId) ?? vendors[0]

  const handleCreate = async () => {
    setBusy(true)
    try {
      const account = await createKermesAccessAccount({
        name,
        role,
        vendor: role === 'vendor' ? selectedVendor : undefined,
      })
      setLastAccount(account)
      setName('')
      onToast('Acceso creado', 'ok')
    } catch (e: any) {
      onToast(e.message ?? 'No se pudo crear el acceso', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid lg:grid-cols-[340px_1fr] gap-4">
      <div className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
        <h1 className="text-lg font-bold mb-4">Crear acceso</h1>
        <label className="text-xs text-slate-600 block mb-1.5">Nombre del celular</label>
        <input value={name} onChange={e => setName(e.target.value)} className="input mb-3" placeholder="Caja bebidas / Banco 1" />
        <label className="text-xs text-slate-600 block mb-1.5">Rol</label>
        <select value={role} onChange={e => setRole(e.target.value as 'vendor' | 'bank')} className="input mb-3">
          <option value="vendor">Tienda: solo cobrar</option>
          <option value="bank">Banco: solo recargar</option>
        </select>
        {role === 'vendor' && (
          <>
            <label className="text-xs text-slate-600 block mb-1.5">Tienda asignada</label>
            <select value={vendorId || selectedVendor?.id || ''} onChange={e => setVendorId(e.target.value)} className="input mb-4">
              {vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </select>
          </>
        )}
        <button onClick={handleCreate} disabled={busy || !name.trim() || (role === 'vendor' && !selectedVendor)} className="w-full rounded-xl bg-sp-gold/15 border border-sp-gold/30 text-sp-gold py-3 font-semibold disabled:opacity-40">
          Crear cuenta
        </button>
        {lastAccount && (
          <div className="mt-4 rounded-xl bg-sp-bg3 border border-white/5 p-3">
            <div className="text-xs text-slate-600 mb-2">Entrega estos datos al celular asignado</div>
            <div className="font-mono text-base font-bold text-sp-accent break-all">{lastAccount.email.split('@')[0]}</div>
            <div className="font-mono text-[11px] text-slate-600 break-all">{lastAccount.email}</div>
            <div className="font-mono text-lg font-bold text-sp-gold mt-2">{lastAccount.password}</div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
        <h1 className="text-lg font-bold mb-4">Cuentas de Kermés</h1>
        <div className="space-y-2">
          {accessList.map(access => (
            <AccessRow key={access.id} access={access} vendors={vendors} onToast={onToast} />
          ))}
          {accessList.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-600">
              Todavía no hay cuentas para celulares.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function AccessRow({
  access,
  vendors,
  onToast,
}: {
  access: KermesAccess
  vendors: KermesVendor[]
  onToast: (msg: string, type?: 'ok' | 'err') => void
}) {
  const [name, setName] = useState(access.name)
  const [saving, setSaving] = useState(false)

  useEffect(() => setName(access.name), [access.name])

  const saveName = async () => {
    const cleanName = name.trim()
    if (!cleanName || cleanName === access.name) return
    setSaving(true)
    try {
      await updateKermesAccess(access.id, { name: cleanName })
      onToast('Nombre actualizado', 'ok')
    } catch (e: any) {
      onToast(e.message ?? 'No se pudo actualizar el nombre', 'err')
      setName(access.name)
    } finally {
      setSaving(false)
    }
  }

  const updateRole = async (nextRole: 'vendor' | 'bank') => {
    const vendor = vendors.find(v => v.id === access.vendorId) ?? vendors[0]
    try {
      await updateKermesAccess(access.id, {
        role: nextRole,
        vendorId: nextRole === 'vendor' ? vendor?.id ?? '' : '',
        vendorName: nextRole === 'vendor' ? vendor?.name ?? '' : '',
      })
      onToast('Rol actualizado', 'ok')
    } catch (e: any) {
      onToast(e.message ?? 'No se pudo actualizar el rol', 'err')
    }
  }

  const updateVendor = async (nextVendorId: string) => {
    const vendor = vendors.find(v => v.id === nextVendorId)
    if (!vendor) return
    try {
      await updateKermesAccess(access.id, { vendorId: vendor.id, vendorName: vendor.name })
      onToast('Tienda actualizada', 'ok')
    } catch (e: any) {
      onToast(e.message ?? 'No se pudo actualizar la tienda', 'err')
    }
  }

  const toggleActive = async () => {
    try {
      await updateKermesAccess(access.id, { active: !access.active })
      onToast(access.active ? 'Acceso desactivado' : 'Acceso activado', 'ok')
    } catch (e: any) {
      onToast(e.message ?? 'No se pudo cambiar el estado', 'err')
    }
  }

  const remove = async () => {
    if (!window.confirm(`¿Borrar el acceso "${access.name}"? Ese celular ya no podrá entrar como terminal.`)) return
    try {
      await deleteKermesAccess(access.id)
      onToast('Acceso borrado', 'ok')
    } catch (e: any) {
      onToast(e.message ?? 'No se pudo borrar el acceso', 'err')
    }
  }

  return (
    <div className="rounded-xl bg-sp-bg3 border border-white/5 p-3">
      <div className="grid xl:grid-cols-[1.2fr_150px_190px_auto_auto] gap-2 items-center">
        <div className="min-w-0">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={saveName}
            disabled={saving}
            className="input text-sm mb-1"
          />
          <div className="font-mono text-xs text-slate-600 truncate">{access.email}</div>
        </div>
        <select value={access.role} onChange={e => updateRole(e.target.value as 'vendor' | 'bank')} className="input text-sm">
          <option value="vendor">Tienda</option>
          <option value="bank">Banco</option>
        </select>
        <select
          value={access.vendorId ?? ''}
          onChange={e => updateVendor(e.target.value)}
          disabled={access.role !== 'vendor'}
          className="input text-sm disabled:opacity-40"
        >
          <option value="">Sin tienda</option>
          {vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
        </select>
        <button
          onClick={toggleActive}
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${access.active ? 'border-green-700/30 text-green-300 bg-green-950/30' : 'border-red-700/30 text-red-300 bg-red-950/30'}`}
        >
          {access.active ? 'Activo' : 'Inactivo'}
        </button>
        <button onClick={remove} className="rounded-lg border border-red-700/30 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-300">
          Borrar
        </button>
      </div>
    </div>
  )
}

// ─── RECEIPT MODAL ────────────────────────────────────────────────────────────

function ReceiptModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-sp-bg2 border border-white/10 p-5 text-center shadow-2xl">
        <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center text-2xl mb-4 ${receipt.type === 'charge' ? 'bg-red-950/60 text-red-300' : 'bg-green-950/60 text-green-300'}`}>
          {receipt.type === 'charge' ? '−' : '+'}
        </div>
        <h2 className="text-lg font-bold mb-1">{receipt.type === 'charge' ? 'Cobro realizado' : 'Recarga realizada'}</h2>
        <p className="text-xs text-slate-500 mb-5">{receipt.cardId}{receipt.vendorName ? ` · ${receipt.vendorName}` : ''}</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl bg-sp-bg3 p-3">
            <div className="text-xs text-slate-600 mb-1">Monto</div>
            <div className="text-xl font-black text-slate-100">{fmtCoins(receipt.amount)}</div>
          </div>
          <div className="rounded-xl bg-sp-bg3 p-3">
            <div className="text-xs text-slate-600 mb-1">Saldo</div>
            <div className="text-xl font-black text-sp-gold">{fmtCoins(receipt.balance)}</div>
          </div>
        </div>
        <button onClick={onClose} className="w-full rounded-xl bg-sp-gold/15 border border-sp-gold/30 text-sp-gold py-3 font-semibold">
          Listo
        </button>
      </div>
    </div>
  )
}

// ─── CARD LIST ────────────────────────────────────────────────────────────────

function KermesCardList({ cards, onSelect }: { cards: KermesCard[]; onSelect: (card: KermesCard) => void }) {
  return (
    <aside className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
      <h2 className="text-sm font-semibold mb-3">Tarjetas activas</h2>
      <div className="space-y-2 max-h-[520px] overflow-auto">
        {cards.map(card => (
          <button key={card.id} onClick={() => onSelect(card)} className="w-full text-left rounded-lg bg-white/[0.03] border border-white/5 p-3 hover:border-sp-gold/30">
            <div className="flex justify-between gap-3">
              <span className="font-mono text-xs text-sp-accent">{card.id}</span>
              <span className="text-xs font-bold text-sp-gold">{fmtCoins(card.balance)}</span>
            </div>
            <div className="text-sm text-slate-300 mt-1 truncate">{card.label}</div>
          </button>
        ))}
      </div>
    </aside>
  )
}

// ─── CARDS ADMIN ──────────────────────────────────────────────────────────────

function KermesCardsAdmin({ cards, onToast }: { cards: KermesCard[]; onToast: (msg: string, type?: 'ok' | 'err') => void }) {
  const [label, setLabel] = useState('')

  const handleCreate = async () => {
    if (!label.trim()) return
    try {
      const card = await createKermesCard(label.trim())
      onToast(`Tarjeta creada: ${card.id}`, 'ok')
      setLabel('')
    } catch (e: any) {
      onToast(e.message ?? 'No se pudo crear la tarjeta', 'err')
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
      <h1 className="text-lg font-bold mb-4">Configurar tarjetas</h1>
      <div className="flex gap-2 mb-4">
        <input value={label} onChange={e => setLabel(e.target.value)} className="input flex-1" placeholder="Familia García / Puesto 12 / Tarjeta 01" />
        <button onClick={handleCreate} className="px-4 rounded-lg bg-sp-gold/15 border border-sp-gold/30 text-sp-gold font-semibold">Crear</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {cards.map(card => (
          <KermesCardItem key={card.id} card={card} onToast={onToast} />
        ))}
      </div>
    </section>
  )
}

function KermesCardItem({ card, onToast }: { card: KermesCard; onToast: (msg: string, type?: 'ok' | 'err') => void }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    try {
      await deleteKermesCard(card.id)
      onToast(`Tarjeta ${card.id} eliminada`, 'ok')
    } catch (e: any) {
      onToast(e.message ?? 'No se pudo eliminar', 'err')
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="rounded-lg bg-sp-bg3 border border-white/5 p-3">
      <div className="font-mono text-xs text-sp-accent">{card.id}</div>
      <div className="text-sm font-semibold mt-1">{card.label}</div>
      <div className="text-lg font-black text-sp-gold mt-2">{fmtCoins(card.balance)}</div>
      <button
        onClick={() => writeNFCTag(card.id).then(() => onToast(`NFC escrito: ${card.id}`, 'ok')).catch(e => onToast(e.message, 'err'))}
        className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs text-slate-300"
      >
        Escribir NFC
      </button>
      {confirming ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setConfirming(false)}
            className="rounded-lg border border-white/10 py-1.5 text-xs text-slate-400"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-950/60 border border-red-700/40 py-1.5 text-xs text-red-300 font-bold disabled:opacity-40"
          >
            {deleting ? '...' : 'Eliminar'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleDelete}
          className="mt-2 w-full rounded-lg border border-red-900/30 py-1.5 text-xs text-red-500 hover:bg-red-950/30 transition-colors"
        >
          Eliminar tarjeta
        </button>
      )}
    </div>
  )
}

// ─── VENDORS ADMIN ────────────────────────────────────────────────────────────

function KermesVendorsAdmin({
  vendors,
  selectedVendorId,
  onSelectVendor,
  products,
  onToast,
}: {
  vendors: KermesVendor[]
  selectedVendorId: string
  onSelectVendor: (vendorId: string) => void
  products: KermesProduct[]
  onToast: (msg: string, type?: 'ok' | 'err') => void
}) {
  const [name, setName] = useState('')
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    await createKermesVendor(name.trim())
    onToast('Tienda creada', 'ok')
    setName('')
  }

  const handleCreateProduct = async () => {
    try {
      await createKermesProduct(selectedVendorId, productName, Number(productPrice))
      onToast('Producto creado', 'ok')
      setProductName('')
      setProductPrice('')
    } catch (e: any) {
      onToast(e.message ?? 'No se pudo crear el producto', 'err')
    }
  }

  return (
    <section className="grid lg:grid-cols-[280px_1fr] gap-4">
      <div className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
        <h1 className="text-lg font-bold mb-4">Tiendas</h1>
        <div className="flex gap-2 mb-4">
          <input value={name} onChange={e => setName(e.target.value)} className="input flex-1" placeholder="Tacos, Bebidas..." />
          <button onClick={handleCreate} className="px-4 rounded-lg bg-sp-gold/15 border border-sp-gold/30 text-sp-gold font-semibold">+</button>
        </div>
        <div className="space-y-2">
          {vendors.map(vendor => (
            <div
              key={vendor.id}
              className={`rounded-lg border px-3 py-2 ${selectedVendorId === vendor.id ? 'bg-sp-gold/10 border-sp-gold/30' : 'bg-sp-bg3 border-white/5'}`}
            >
              <button onClick={() => onSelectVendor(vendor.id)} className="w-full text-left text-sm font-semibold">{vendor.name}</button>
              <button onClick={() => deleteKermesVendor(vendor.id)} className="text-xs text-red-400 mt-1">Eliminar</button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-lg font-bold">Productos</h1>
          <span className="text-xs text-slate-600">{vendors.find(v => v.id === selectedVendorId)?.name ?? 'Selecciona tienda'}</span>
        </div>
        <div className="grid sm:grid-cols-[1fr_130px_auto] gap-2 mb-4">
          <input value={productName} onChange={e => setProductName(e.target.value)} className="input" placeholder="Quesadilla, Agua, Juego..." />
          <input value={productPrice} onChange={e => setProductPrice(e.target.value.replace(/[^\d]/g, ''))} className="input font-mono" placeholder="Precio" />
          <button onClick={handleCreateProduct} disabled={!selectedVendorId} className="px-4 rounded-lg bg-sp-gold/15 border border-sp-gold/30 text-sp-gold font-semibold disabled:opacity-40">Agregar</button>
        </div>

        <div className="space-y-2">
          {products.map(product => (
            <ProductRow key={product.id} product={product} onToast={onToast} />
          ))}
          {products.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-600">
              Esta tienda todavía no tiene productos.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ProductRow({ product, onToast }: { product: KermesProduct; onToast: (msg: string, type?: 'ok' | 'err') => void }) {
  const [name, setName] = useState(product.name)
  const [price, setPrice] = useState(String(product.price))

  const save = async () => {
    try {
      await updateKermesProduct(product.id, { name: name.trim(), price: Number(price) })
      onToast('Producto actualizado', 'ok')
    } catch (e: any) {
      onToast(e.message ?? 'No se pudo actualizar', 'err')
    }
  }

  return (
    <div className="grid grid-cols-[1fr_110px_auto_auto] gap-2 items-center rounded-lg bg-sp-bg3 border border-white/5 p-2">
      <input value={name} onChange={e => setName(e.target.value)} onBlur={save} className="input text-sm" />
      <input value={price} onChange={e => setPrice(e.target.value.replace(/[^\d]/g, ''))} onBlur={save} className="input font-mono text-sm" />
      <span className="text-sm font-bold text-sp-gold">{fmtCoins(Number(price) || 0)}</span>
      <button onClick={() => deleteKermesProduct(product.id).then(() => onToast('Producto eliminado', 'ok'))} className="text-xs text-red-400 px-2">Eliminar</button>
    </div>
  )
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function KermesDashboard({
  txs,
  vendors,
  cards,
  historyEvents,
  onOpenClose,
}: {
  txs: KermesTransaction[]
  vendors: KermesVendor[]
  cards: KermesCard[]
  historyEvents: KermesHistoryEvent[]
  onOpenClose: () => void
}) {
  const purchases = txs.filter(tx => tx.type === 'purchase')
  const recharges = txs.filter(tx => tx.type === 'recharge')

  const totalBank = recharges.reduce((sum, tx) => sum + tx.amount, 0)
  const totalSales = purchases.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const remainingBalance = cards.reduce((sum, c) => sum + c.balance, 0)

  const salesByVendor = vendors
    .map(vendor => {
      const vtxs = purchases.filter(tx => tx.vendorId === vendor.id)
      return { id: vendor.id, name: vendor.name, total: vtxs.reduce((s, tx) => s + Math.abs(tx.amount), 0), count: vtxs.length }
    })
    .sort((a, b) => b.total - a.total)

  const knownVendorIds = new Set(vendors.map(v => v.id))
  const deletedVendorMap = new Map<string, { name: string; total: number; count: number }>()
  purchases.forEach(tx => {
    if (!tx.vendorId || knownVendorIds.has(tx.vendorId)) return
    const entry = deletedVendorMap.get(tx.vendorId) ?? { name: tx.vendorName ?? tx.vendorId, total: 0, count: 0 }
    entry.total += Math.abs(tx.amount)
    entry.count++
    deletedVendorMap.set(tx.vendorId, entry)
  })

  const maxSale = Math.max(...salesByVendor.map(v => v.total), 1)

  return (
    <section className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-700/30 bg-green-950/20 p-4">
          <div className="text-xs text-green-400/60 mb-1 uppercase tracking-wide">Ingresado al banco</div>
          <div className="text-3xl font-black text-green-300">{fmtCoins(totalBank)}</div>
          <div className="text-xs text-slate-600 mt-1">{recharges.length} recarga{recharges.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-xl border border-red-700/30 bg-red-950/20 p-4">
          <div className="text-xs text-red-400/60 mb-1 uppercase tracking-wide">Total vendido</div>
          <div className="text-3xl font-black text-red-300">{fmtCoins(totalSales)}</div>
          <div className="text-xs text-slate-600 mt-1">{purchases.length} cobro{purchases.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-xl border border-sp-gold/20 bg-sp-gold/5 p-4">
          <div className="text-xs text-sp-gold/60 mb-1 uppercase tracking-wide">Saldo en circulación</div>
          <div className="text-3xl font-black text-sp-gold">{fmtCoins(remainingBalance)}</div>
          <div className="text-xs text-slate-600 mt-1">{cards.length} tarjeta{cards.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
        <h2 className="text-base font-bold mb-4">Ventas por tienda</h2>
        {salesByVendor.length === 0 && deletedVendorMap.size === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-600">
            Sin ventas registradas todavía.
          </div>
        ) : (
          <div className="space-y-2">
            {salesByVendor.map(v => (
              <div key={v.id} className="rounded-lg bg-sp-bg3 border border-white/5 px-4 py-3">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <span className="font-semibold text-slate-200">{v.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{v.count} cobro{v.count !== 1 ? 's' : ''}</span>
                    <span className="text-xl font-black text-sp-gold">{fmtCoins(v.total)}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sp-gold/60 transition-all duration-500"
                    style={{ width: `${(v.total / maxSale) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {[...deletedVendorMap.entries()].map(([id, v]) => (
              <div key={id} className="rounded-lg bg-sp-bg3 border border-white/5 px-4 py-3 opacity-50">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-400">{v.name} <span className="text-xs font-normal">(eliminada)</span></span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{v.count} cobro{v.count !== 1 ? 's' : ''}</span>
                    <span className="text-xl font-black text-slate-500">{fmtCoins(v.total)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onOpenClose}
        className="w-full rounded-xl bg-red-950/30 border border-red-700/30 text-red-300 py-3 font-semibold hover:bg-red-950/50 transition-colors"
      >
        Cerrar Kermés y guardar historial
      </button>

      {historyEvents.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
          <h2 className="text-base font-bold mb-3">Kermeses anteriores</h2>
          <div className="space-y-2">
            {historyEvents.map(event => (
              <KermesHistoryEventRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function KermesHistoryEventRow({ event }: { event: KermesHistoryEvent }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg bg-sp-bg3 border border-white/5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="text-sm font-semibold text-slate-200">
            {format(event.closedAt, "d 'de' MMMM 'de' yyyy", { locale: es })}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {event.summary.totalCards} tarjetas · {event.summary.totalPurchases} cobros · {event.summary.totalRecharges} recargas
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-sp-gold">{fmtCoins(event.summary.totalSales)}</div>
          <div className="text-xs text-slate-600">vendido</div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-sp-bg2 border border-white/5 p-2 text-center">
              <div className="text-xs text-slate-500">Banco</div>
              <div className="font-bold text-green-300">{fmtCoins(event.summary.totalBank)}</div>
            </div>
            <div className="rounded-lg bg-sp-bg2 border border-white/5 p-2 text-center">
              <div className="text-xs text-slate-500">Vendido</div>
              <div className="font-bold text-red-300">{fmtCoins(event.summary.totalSales)}</div>
            </div>
            <div className="rounded-lg bg-sp-bg2 border border-white/5 p-2 text-center">
              <div className="text-xs text-slate-500">Sin gastar</div>
              <div className="font-bold text-sp-gold">{fmtCoins(event.summary.remainingBalance)}</div>
            </div>
          </div>
          {event.summary.salesByVendor.length > 0 && (
            <div>
              <div className="text-xs text-slate-500 mb-1.5 font-semibold">Por tienda</div>
              {event.summary.salesByVendor.map(v => (
                <div key={v.vendorId} className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0">
                  <span className="text-slate-400">{v.vendorName}</span>
                  <span className="text-sp-gold font-bold">{fmtCoins(v.total)}</span>
                </div>
              ))}
            </div>
          )}
          {event.cards.length > 0 && (
            <details>
              <summary className="text-xs text-slate-500 cursor-pointer">Ver saldos de tarjetas al cierre ({event.cards.length})</summary>
              <div className="mt-2 space-y-1 max-h-48 overflow-auto">
                {event.cards.map(c => (
                  <div key={c.id} className="flex justify-between text-xs py-1 border-b border-white/5 last:border-0">
                    <span className="font-mono text-sp-accent">{c.id}</span>
                    <span className="text-slate-400 truncate mx-2 flex-1">{c.label}</span>
                    <span className="text-sp-gold">{fmtCoins(c.balance)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────

function KermesHistory({ txs }: { txs: KermesTransaction[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
      <h1 className="text-lg font-bold mb-4">Historial de esta sesión</h1>
      <div className="space-y-1">
        {txs.map(tx => (
          <div key={tx.id} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-lg bg-sp-bg3 border border-white/5 px-3 py-2 text-sm">
            <span className={tx.amount > 0 ? 'text-green-400' : 'text-red-400'}>{tx.amount > 0 ? 'Recarga' : 'Cobro'}</span>
            <span className="text-slate-400 truncate">{tx.cardId} · {tx.vendorName ?? tx.note ?? 'Sin nota'}</span>
            <span className="font-bold text-sp-gold">{fmtCoins(tx.amount)}</span>
          </div>
        ))}
        {txs.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-600">
            Sin transacciones en esta sesión.
          </div>
        )}
      </div>
    </section>
  )
}
