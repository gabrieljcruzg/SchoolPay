'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth'
import {
  chargeKermesCard,
  createKermesCard,
  createKermesProduct,
  createKermesVendor,
  deleteKermesProduct,
  deleteKermesVendor,
  rechargeKermesCard,
  signOutUser,
  subscribeToKermesCards,
  subscribeToKermesProducts,
  subscribeToKermesTransactions,
  subscribeToKermesVendors,
  updateKermesProduct,
} from '@/lib/firestore'
import { useNFC, writeNFCTag } from '@/hooks/useNFC'
import { Spinner, ToastList } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { fmtCoins, type KermesCard, type KermesProduct, type KermesTransaction, type KermesVendor } from '@/types'

type KermesTab = 'pos' | 'cards' | 'vendors' | 'history'

export default function KermesPage() {
  const { user, loading, isTeacher } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isTeacher) router.replace('/')
  }, [loading, isTeacher, router])

  if (loading || !isTeacher) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size={32} /></div>
  }

  return <KermesManager teacherId={user!.uid} />
}

function KermesManager({ teacherId }: { teacherId: string }) {
  const [cards, setCards] = useState<KermesCard[]>([])
  const [vendors, setVendors] = useState<KermesVendor[]>([])
  const [products, setProducts] = useState<KermesProduct[]>([])
  const [txs, setTxs] = useState<KermesTransaction[]>([])
  const [tab, setTab] = useState<KermesTab>('pos')
  const [selectedCardId, setSelectedCardId] = useState('')
  const [manualId, setManualId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const { toasts, show: showToast, dismiss } = useToast()

  useEffect(() => {
    const unsubs = [
      subscribeToKermesCards(setCards),
      subscribeToKermesVendors(setVendors),
      subscribeToKermesTransactions(setTxs),
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  useEffect(() => {
    if (!vendorId && vendors[0]) setVendorId(vendors[0].id)
  }, [vendorId, vendors])

  useEffect(() => {
    if (!vendorId) {
      setProducts([])
      return
    }
    setCart({})
    return subscribeToKermesProducts(vendorId, setProducts)
  }, [vendorId])

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

  const parsedAmount = cartTotal || Number(amount)

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
      await chargeKermesCard(selectedCardId, selectedVendor, parsedAmount, teacherId, txNote, items)
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
      await rechargeKermesCard(selectedCardId, parsedAmount, teacherId, note.trim() || undefined)
      showToast(`Recarga aplicada: ${fmtCoins(parsedAmount)}`, 'ok')
      setAmount('')
      setNote('')
    } catch (e: any) {
      showToast(e.message ?? 'No se pudo recargar', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-sp-bg">
      <nav className="bg-sp-bg2 border-b border-white/5 px-4 h-14 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">← Panel</Link>
        <span className="text-white/10">|</span>
        <span className="font-semibold text-sm">Modo Kermés</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={signOutUser} className="text-xs text-slate-700 hover:text-slate-500 transition-colors px-2">Salir</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-5 overflow-x-auto">
          {([
            ['pos', 'Cobrar'],
            ['cards', 'Tarjetas'],
            ['vendors', 'Tiendas'],
            ['history', 'Historial'],
          ] as const).map(([id, label]) => (
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
              <h1 className="text-lg font-bold mb-4">Cobro y recarga</h1>
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
                <div>
                  <label className="text-xs text-slate-600 block mb-1.5">Tienda</label>
                  <select value={vendorId} onChange={e => setVendorId(e.target.value)} className="input">
                    {vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 block mb-1.5">Monto manual</label>
                  <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))} className="input font-mono" placeholder="Opcional" disabled={cartTotal > 0} />
                </div>
              </div>

              <div className="mt-4">
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
              </div>

              {cartItems.length > 0 && (
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
                <button disabled={!selectedCard || !parsedAmount || busy} onClick={handleCharge} className="bg-red-950/40 border border-red-700/30 text-red-300 rounded-lg py-3 font-semibold disabled:opacity-40">
                  Cobrar
                </button>
                <button disabled={!selectedCard || !parsedAmount || busy} onClick={handleRecharge} className="bg-green-950/40 border border-green-700/30 text-green-300 rounded-lg py-3 font-semibold disabled:opacity-40">
                  Recargar
                </button>
              </div>
            </div>

            <KermesCardList cards={cards} onSelect={card => { setSelectedCardId(card.id); setManualId(card.id) }} />
          </section>
        )}

        {tab === 'cards' && <KermesCardsAdmin cards={cards} onToast={showToast} />}
        {tab === 'vendors' && <KermesVendorsAdmin vendors={vendors} selectedVendorId={vendorId} onSelectVendor={setVendorId} products={products} onToast={showToast} />}
        {tab === 'history' && <KermesHistory txs={txs} />}
      </main>

      <ToastList toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

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
          <div key={card.id} className="rounded-lg bg-sp-bg3 border border-white/5 p-3">
            <div className="font-mono text-xs text-sp-accent">{card.id}</div>
            <div className="text-sm font-semibold mt-1">{card.label}</div>
            <div className="text-lg font-black text-sp-gold mt-2">{fmtCoins(card.balance)}</div>
            <button
              onClick={() => writeNFCTag(card.id).then(() => onToast(`NFC escrito: ${card.id}`, 'ok')).catch(e => onToast(e.message, 'err'))}
              className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs text-slate-300"
            >
              Escribir NFC
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

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

function KermesHistory({ txs }: { txs: KermesTransaction[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-sp-bg2 p-4">
      <h1 className="text-lg font-bold mb-4">Historial</h1>
      <div className="space-y-1">
        {txs.map(tx => (
          <div key={tx.id} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-lg bg-sp-bg3 border border-white/5 px-3 py-2 text-sm">
            <span className={tx.amount > 0 ? 'text-green-400' : 'text-red-400'}>{tx.amount > 0 ? 'Recarga' : 'Cobro'}</span>
            <span className="text-slate-400 truncate">{tx.cardId} · {tx.vendorName ?? tx.note ?? 'Sin nota'}</span>
            <span className="font-bold text-sp-gold">{fmtCoins(tx.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
