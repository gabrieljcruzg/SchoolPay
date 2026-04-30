'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { getKermesCard } from '@/lib/firestore'
import { useNFC } from '@/hooks/useNFC'
import { Spinner } from '@/components/ui'
import { fmtCoins, type KermesCard } from '@/types'

export default function KermesBalancePage() {
  const [manualId, setManualId] = useState('')
  const [card, setCard] = useState<KermesCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const lookup = useCallback(async (cardId: string) => {
    const cleaned = cardId.trim().toUpperCase()
    if (!cleaned) return
    setLoading(true)
    setError('')
    try {
      const found = await getKermesCard(cleaned)
      if (!found || found.active === false) {
        setCard(null)
        setError('Tarjeta no encontrada')
        return
      }
      setCard(found)
      setManualId(found.id)
    } catch (e: any) {
      setCard(null)
      setError(e.message ?? 'No se pudo consultar el saldo')
    } finally {
      setLoading(false)
    }
  }, [])

  const { status, startScan, stopScan, supported, submitManual } = useNFC({
    onRead: lookup,
  })

  return (
    <div className="min-h-screen bg-sp-bg flex flex-col">
      <nav className="bg-sp-bg2 border-b border-white/5 px-4 h-14 flex items-center gap-3">
        <Link href="/" className="text-slate-600 hover:text-slate-400 text-sm">← Inicio</Link>
        <span className="text-white/10">|</span>
        <span className="font-semibold text-sm">Consultar saldo</span>
      </nav>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-sp-gold to-yellow-400 rounded-2xl inline-flex items-center justify-center text-3xl font-black text-yellow-950 mb-4">
              ₡
            </div>
            <h1 className="text-2xl font-bold">Saldo Kermés</h1>
          </div>

          <div className="rounded-2xl border border-white/10 bg-sp-bg2 p-5">
            <button
              onClick={status === 'scanning' ? stopScan : startScan}
              className="w-full bg-sp-gold/15 border border-sp-gold/30 text-sp-gold rounded-xl py-4 font-semibold mb-3"
            >
              {status === 'scanning' ? 'Esperando tarjeta... tocar para cancelar' : 'Leer tarjeta NFC'}
            </button>
            {!supported && (
              <p className="text-xs text-slate-600 text-center mb-3">Este dispositivo no soporta NFC. Escribe el ID.</p>
            )}

            <div className="flex gap-2">
              <input
                value={manualId}
                onChange={e => setManualId(e.target.value.toUpperCase())}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitManual(manualId)
                }}
                placeholder="K-ABC12345"
                className="input flex-1 font-mono"
              />
              <button onClick={() => submitManual(manualId)} className="px-4 rounded-lg border border-white/10 text-slate-300">
                Ver
              </button>
            </div>

            {loading && (
              <div className="flex justify-center py-8"><Spinner size={28} /></div>
            )}

            {error && <p className="text-sm text-red-400 text-center mt-4">{error}</p>}

            {card && !loading && (
              <div className="rounded-2xl bg-sp-bg3 p-5 text-center mt-5">
                <div className="text-xs text-slate-500 font-mono">{card.id}</div>
                <div className="text-lg font-semibold mt-1">{card.label}</div>
                <div className="text-5xl font-black text-sp-gold mt-5">{fmtCoins(card.balance)}</div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
