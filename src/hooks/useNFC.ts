'use client'

import { useState, useRef, useCallback } from 'react'

export type NFCMode = 'nfc' | 'manual'
export type NFCScanStatus = 'idle' | 'scanning' | 'success' | 'error' | 'unsupported'

interface UseNFCOptions {
  onRead: (studentId: string) => void
  onError?: (err: Error) => void
}

interface UseNFCReturn {
  status:    NFCScanStatus
  mode:      NFCMode
  supported: boolean
  startScan: () => Promise<void>
  stopScan:  () => void
  setMode:   (m: NFCMode) => void
  submitManual: (id: string) => void
}

export function useNFC({ onRead, onError }: UseNFCOptions): UseNFCReturn {
  const [status, setStatus]   = useState<NFCScanStatus>('idle')
  const [mode, setMode]       = useState<NFCMode>('nfc')
  // NDEFReader no tiene tipos en TypeScript por defecto — usamos unknown
  const readerRef = useRef<unknown>(null)
  const abortRef  = useRef<AbortController | null>(null)

  // Detecta soporte en runtime (no en SSR)
  const supported = typeof window !== 'undefined' && 'NDEFReader' in window

  const stopScan = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
  }, [])

  const startScan = useCallback(async () => {
    if (!supported) {
      setStatus('unsupported')
      return
    }

    setStatus('scanning')
    abortRef.current = new AbortController()

    try {
      // @ts-expect-error — NDEFReader no está en el lib de TS todavía
      const reader = new NDEFReader()
      readerRef.current = reader

      await reader.scan({ signal: abortRef.current.signal })

      reader.addEventListener('reading', ({ message }: any) => {
        // Busca el primer record de tipo texto
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const decoder = new TextDecoder(record.encoding ?? 'utf-8')
            const studentId = decoder.decode(record.data).trim().toUpperCase()
            setStatus('success')
            onRead(studentId)
            // Reinicia para el siguiente escaneo después de 1.5s
            setTimeout(() => setStatus('scanning'), 1500)
            return
          }
        }
        onError?.(new Error('El sticker NFC no contiene un ID válido'))
        setStatus('error')
        setTimeout(() => setStatus('scanning'), 2000)
      })

      reader.addEventListener('readingerror', () => {
        onError?.(new Error('Error al leer el sticker NFC'))
        setStatus('error')
        setTimeout(() => setStatus('scanning'), 2000)
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('idle')
        return
      }
      console.error('[useNFC]', err)
      onError?.(err as Error)
      setStatus('error')
    }
  }, [supported, onRead, onError])

  const submitManual = useCallback((id: string) => {
    const cleaned = id.trim().toUpperCase()
    if (!cleaned) return
    setStatus('success')
    onRead(cleaned)
    setTimeout(() => setStatus('idle'), 1500)
  }, [onRead])

  return { status, mode, supported, startScan, stopScan, setMode, submitManual }
}

// ─── Helper: graba el ID en un sticker NFC ────────────────────────────────────
// Se llama desde la pantalla de configuración de alumnos

export async function writeNFCTag(studentId: string): Promise<void> {
  if (!('NDEFReader' in window)) {
    throw new Error('Tu dispositivo no soporta escritura NFC')
  }
  // @ts-expect-error — NDEFReader no está en el lib de TS todavía
  const writer = new NDEFReader()
  await writer.write({
    records: [{
      recordType: 'text',
      data: studentId,
      lang: 'es',
    }],
  })
}
