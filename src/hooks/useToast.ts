'use client'

import { useState, useRef, useCallback } from 'react'

export type ToastType = 'ok' | 'err' | 'info'

export interface Toast {
  id:      string
  msg:     string
  type:    ToastType
  undoFn?: () => void
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts((p) => p.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((
    msg: string,
    type: ToastType = 'ok',
    undoFn?: () => void,
  ) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((p) => [...p.slice(-2), { id, msg, type, undoFn }])
    timers.current[id] = setTimeout(() => dismiss(id), undoFn ? 5000 : 3200)
    return id
  }, [dismiss])

  return { toasts, show, dismiss }
}
