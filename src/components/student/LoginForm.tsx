'use client'

import { useState, useRef } from 'react'
import { studentSignIn } from '@/lib/firestore'

interface LoginFormProps {
  onSuccess: () => void
}

export function StudentLoginForm({ onSuccess }: LoginFormProps) {
  const [id,      setId]      = useState('')
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [shake,   setShake]   = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  const tryLogin = async () => {
    if (!id.trim() || pin.length < 4) {
      triggerShake('Ingresa tu ID y PIN completo')
      return
    }
    setLoading(true)
    setError('')
    try {
      await studentSignIn(id.trim(), pin)
      onSuccess()
    } catch {
      triggerShake('ID o PIN incorrecto. Revisa tu tarjeta.')
      setPin('')
      pinRef.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  const triggerShake = (msg: string) => {
    setError(msg)
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5"
      style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(232,184,75,.06) 0%, transparent 70%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-sp-gold to-yellow-400 rounded-2xl inline-flex items-center justify-center text-2xl font-black text-yellow-950 mb-3">
            ₡
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SchoolPay</h1>
          <p className="text-sm text-slate-600 mt-1">Portal del Alumno</p>
        </div>

        {/* Card mockup */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <p className="text-xs text-slate-600 text-center mb-4">
            Usa los datos impresos en tu tarjeta
          </p>

          {/* Physical card visual */}
          <div
            className="rounded-xl p-4 mb-5 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #1a2d50 0%, #0d1f3c 60%)',
              border: '1px solid rgba(232,184,75,0.3)',
            }}
          >
            {/* Glow */}
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(232,184,75,.15) 0%, transparent 70%)' }} />

            <div className="text-sm font-bold text-sp-gold mb-3">SchoolPay</div>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 rounded-lg p-2"
                style={{ background: 'rgba(232,184,75,.12)', border: '1px solid rgba(232,184,75,.25)' }}>
                <div className="text-xs text-slate-600 mb-1">ID · Usuario</div>
                <div className="text-sm font-bold text-sp-accent font-mono">3A-017</div>
              </div>
              <div className="flex-1 rounded-lg p-2"
                style={{ background: 'rgba(232,184,75,.12)', border: '1px solid rgba(232,184,75,.25)' }}>
                <div className="text-xs text-slate-600 mb-1">PIN</div>
                <div className="text-sm font-bold text-sp-gold font-mono tracking-widest">4829</div>
              </div>
            </div>
            <div className="text-xs text-slate-600 font-mono tracking-wider">GARCÍA LÓPEZ, ANDREA</div>
          </div>

          {/* Form */}
          <div
            className="flex flex-col gap-3"
            style={{ animation: shake ? 'shake .3s ease' : undefined }}
          >
            <div>
              <label className="text-xs text-slate-600 block mb-1.5">ID de alumno</label>
              <input
                value={id}
                onChange={(e) => setId(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') pinRef.current?.focus() }}
                placeholder="Ej: 3A-017"
                className="input font-mono uppercase"
                autoComplete="username"
                autoCapitalize="characters"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1.5">PIN de 4 dígitos</label>
              <input
                ref={pinRef}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => e.key === 'Enter' && tryLogin()}
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="● ● ● ●"
                className="input font-mono text-center text-xl tracking-[0.5em]"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              onClick={tryLogin}
              disabled={loading}
              className="w-full font-bold py-3.5 rounded-xl text-yellow-950 transition-all active:scale-95 disabled:opacity-50 mt-1"
              style={{ background: 'linear-gradient(135deg, #e8b84b, #d4a032)' }}
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-700 text-center">
          Si no tienes tu tarjeta, pide ayuda a tu docente
        </p>
      </div>
    </div>
  )
}
