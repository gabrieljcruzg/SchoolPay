'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }   from '@/lib/auth'
import { subscribeToStudents } from '@/lib/firestore'
import { writeNFCTag }         from '@/hooks/useNFC'
import { Avatar, Spinner }     from '@/components/ui'
import { LEVEL_COLORS, type Student } from '@/types'
import Link from 'next/link'

const GROUP_ID = process.env.NEXT_PUBLIC_GROUP_NAME ?? '3A'

type StepStatus = 'waiting' | 'writing' | 'done' | 'error'

export default function NFCWriterPage() {
  const { loading, isTeacher } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isTeacher) router.replace('/')
  }, [loading, isTeacher, router])

  if (loading || !isTeacher) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size={32} /></div>
  }

  return <NFCWriter groupId={GROUP_ID} />
}

function NFCWriter({ groupId }: { groupId: string }) {
  const [students,   setStudents]   = useState<Student[]>([])
  const [current,    setCurrent]    = useState(0)
  const [status,     setStatus]     = useState<StepStatus>('waiting')
  const [error,      setError]      = useState('')
  const [completed,  setCompleted]  = useState<Set<string>>(new Set())
  const [started,    setStarted]    = useState(false)
  const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window

  useEffect(() => {
    return subscribeToStudents(groupId, setStudents)
  }, [groupId])

  const currentStudent = students[current]
  const progress = students.length > 0 ? (completed.size / students.length) * 100 : 0
  const allDone  = completed.size === students.length && students.length > 0

  const writeCurrentTag = useCallback(async () => {
    if (!currentStudent) return
    setStatus('writing')
    setError('')
    try {
      await writeNFCTag(currentStudent.id)
      setCompleted(p => new Set([...p, currentStudent.id]))
      setStatus('done')
    } catch (e: any) {
      setError(e.message ?? 'Error al escribir el tag')
      setStatus('error')
    }
  }, [currentStudent])

  const goNext = () => {
    if (current < students.length - 1) {
      setCurrent(p => p + 1)
      setStatus('waiting')
      setError('')
    }
  }

  const goPrev = () => {
    if (current > 0) {
      setCurrent(p => p - 1)
      setStatus('waiting')
      setError('')
    }
  }

  return (
    <div className="min-h-screen bg-sp-bg flex flex-col">
      {/* Nav */}
      <nav className="bg-sp-bg2 border-b border-white/5 px-4 h-14 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/students" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">← Alumnos</Link>
        <span className="text-white/10">|</span>
        <span className="font-semibold text-sm">Escritura NFC en serie</span>
      </nav>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-6">

        {/* NFC not supported */}
        {!nfcSupported && (
          <div className="card border-red-800/30 bg-red-950/20 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-400 text-sm">Web NFC no disponible</p>
                <p className="text-xs text-slate-500 mt-1">
                  Necesitas Chrome en Android con NFC activado. <br/>
                  Verifica que estés en HTTPS (Vercel) y que el NFC esté encendido en tu OnePlus.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-600 mb-2">
            <span>{completed.size} de {students.length} tarjetas escritas</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: allDone
                  ? 'linear-gradient(90deg, #4caf82, #4ade80)'
                  : 'linear-gradient(90deg, #e8b84b, #f5c842)',
              }}
            />
          </div>
        </div>

        {/* All done */}
        {allDone && (
          <div className="card border-green-800/30 bg-green-950/20 text-center py-8 mb-6">
            <div className="text-5xl mb-3">🎉</div>
            <p className="font-bold text-green-400 text-lg">¡Todas las tarjetas escritas!</p>
            <p className="text-sm text-slate-500 mt-2">{students.length} stickers NFC configurados</p>
            <Link
              href="/print"
              className="inline-block mt-4 bg-sp-gold/15 border border-sp-gold/30 text-sp-gold px-6 py-2.5 rounded-lg text-sm font-semibold"
            >
              🖨️ Imprimir tarjetas →
            </Link>
          </div>
        )}

        {/* Current student card */}
        {!allDone && currentStudent && (
          <div className="card border-sp-gold/20 mb-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-600 uppercase tracking-wider">
                Tarjeta {current + 1} de {students.length}
              </span>
              {completed.has(currentStudent.id) && (
                <span className="text-xs text-green-400 bg-green-950/30 px-2 py-0.5 rounded-full">✓ Ya escrita</span>
              )}
            </div>

            <div className="flex items-center gap-4 my-4">
              <Avatar initials={currentStudent.avatar} level={currentStudent.level} size={52} />
              <div>
                <p className="font-bold text-slate-100">{currentStudent.name}</p>
                <p className="font-mono text-sm text-sp-accent mt-0.5">{currentStudent.id}</p>
                <p className="text-xs text-slate-600 mt-0.5">PIN: {currentStudent.pin}</p>
              </div>
            </div>

            {/* Instruction */}
            {status === 'waiting' && (
              <div className="bg-sp-bg3 rounded-xl p-4 text-center mb-4">
                <p className="text-sm text-slate-400">
                  Toma el sticker NFC correspondiente a <strong className="text-slate-200">{currentStudent.name.split(',')[0]}</strong>
                  {' '}y acércalo a la parte trasera del celular
                </p>
              </div>
            )}

            {/* Writing animation */}
            {status === 'writing' && (
              <div className="flex flex-col items-center gap-3 py-4 mb-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-sp-gold/30 animate-ping" />
                  <div className="absolute inset-2 rounded-full border-2 border-sp-gold/50 animate-ping" style={{ animationDelay: '0.15s' }} />
                  <div className="absolute inset-4 rounded-full bg-sp-gold/20 border border-sp-gold flex items-center justify-center text-xl">
                    📡
                  </div>
                </div>
                <p className="text-sm text-sp-gold font-medium">Escribiendo… no retires el sticker</p>
              </div>
            )}

            {/* Success */}
            {status === 'done' && (
              <div className="flex items-center gap-3 bg-green-950/30 border border-green-800/30 rounded-xl p-4 mb-4">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-sm font-semibold text-green-400">¡Escrito correctamente!</p>
                  <p className="text-xs text-slate-500 mt-0.5">El sticker ya contiene el ID {currentStudent.id}</p>
                </div>
              </div>
            )}

            {/* Error */}
            {status === 'error' && (
              <div className="flex items-center gap-3 bg-red-950/30 border border-red-800/30 rounded-xl p-4 mb-4">
                <span className="text-2xl">❌</span>
                <div>
                  <p className="text-sm font-semibold text-red-400">Error al escribir</p>
                  <p className="text-xs text-slate-500 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {/* Write button */}
            {(status === 'waiting' || status === 'error') && (
              <button
                onClick={writeCurrentTag}
                disabled={!nfcSupported}
                className="w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #e8b84b, #d4a032)', color: '#1a0e00' }}
              >
                {status === 'error' ? '🔄 Reintentar' : '📡 Escribir este sticker'}
              </button>
            )}
          </div>
        )}

        {/* Navigation */}
        {!allDone && students.length > 0 && (
          <div className="flex gap-3">
            <button
              onClick={goPrev}
              disabled={current === 0}
              className="flex-1 py-3 rounded-xl border border-white/10 text-slate-500 text-sm font-medium disabled:opacity-30 hover:border-white/20 transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={goNext}
              disabled={current === students.length - 1}
              className="flex-1 py-3 rounded-xl border border-white/10 text-slate-500 text-sm font-medium disabled:opacity-30 hover:border-white/20 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        )}

        {/* Student mini-list */}
        <div className="mt-6">
          <p className="text-xs text-slate-700 uppercase tracking-wider mb-3">Todos los alumnos</p>
          <div className="flex flex-col gap-1.5">
            {students.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setCurrent(i); setStatus('waiting'); setError('') }}
                className="flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left"
                style={{
                  background: current === i ? 'rgba(232,184,75,0.08)' : 'rgba(255,255,255,0.02)',
                  border:     `1px solid ${current === i ? 'rgba(232,184,75,0.2)' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: completed.has(s.id) ? '#4ade80' : current === i ? '#e8b84b' : '#374151' }}
                />
                <span className="text-xs font-mono text-slate-500">{s.id}</span>
                <span className="text-xs text-slate-400 flex-1 truncate">{s.name.split(',')[0]}</span>
                {completed.has(s.id) && <span className="text-xs text-green-400">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
