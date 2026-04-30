'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter }   from 'next/navigation'
import { useAuth }     from '@/lib/auth'
import {
  subscribeToStudents, createStudent,
  updateStudentName, resetStudentPin, softDeleteStudent,
} from '@/lib/firestore'
import { writeNFCTag } from '@/hooks/useNFC'
import { Avatar, LevelBadge, Spinner, ToastList } from '@/components/ui'
import { useToast } from '@/hooks/useToast'
import { fmtCoins, LEVEL_COLORS, type Student } from '@/types'
import Link from 'next/link'

const GROUP_ID = process.env.NEXT_PUBLIC_GROUP_NAME ?? '3A'

export default function StudentsPage() {
  const { user, loading, isTeacher } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isTeacher) router.replace('/')
  }, [loading, isTeacher, router])

  if (loading || !isTeacher) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size={32} /></div>
  }

  return <StudentManager groupId={GROUP_ID} teacherId={user!.uid} />
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

type ViewMode = 'list' | 'add' | 'edit'

type ImportResult = {
  created: Student[]
  failed: { name: string; error: string }[]
}

function StudentManager({ groupId, teacherId }: { groupId: string; teacherId: string }) {
  const [students, setStudents] = useState<Student[]>([])
  const [mode,     setMode]     = useState<ViewMode>('list')
  const [editing,  setEditing]  = useState<Student | null>(null)
  const [pinVisible, setPinVisible] = useState<Record<string, boolean>>({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toasts, show: showToast, dismiss } = useToast()

  useEffect(() => {
    return subscribeToStudents(groupId, setStudents)
  }, [groupId])

  const handleCreate = async (name: string) => {
    try {
      const s = await createStudent({ name, groupId })
      showToast(`✓ ${s.name.split(',')[1]?.trim()} creado — ID: ${s.id} / PIN: ${s.pin}`, 'ok')
      setMode('list')
    } catch (e: any) {
      showToast(e.message ?? 'Error al crear alumno', 'err')
    }
  }

  const handleImportFile = async (file: File) => {
    setImporting(true)
    setImportResult(null)
    try {
      const names = await readStudentNamesFromSpreadsheet(file)
      if (!names.length) {
        showToast('No encontré nombres válidos en el archivo', 'err')
        return
      }

      const created: Student[] = []
      const failed: ImportResult['failed'] = []

      for (const name of names) {
        try {
          const student = await createStudent({ name, groupId })
          created.push(student)
        } catch (e: any) {
          failed.push({ name, error: getFirebaseErrorMessage(e) })
        }
      }

      setImportResult({ created, failed })
      if (created.length) {
        setPinVisible(p => ({
          ...p,
          ...Object.fromEntries(created.map(s => [s.id, true])),
        }))
      }
      showToast(`Importación lista: ${created.length} creados, ${failed.length} fallidos`, failed.length ? 'info' : 'ok')
    } catch (e: any) {
      showToast(e.message ?? 'No se pudo leer el archivo', 'err')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRename = async (id: string, name: string) => {
    await updateStudentName(id, name)
    showToast('Nombre actualizado', 'ok')
    setEditing(null); setMode('list')
  }

  const handleResetPin = async (s: Student) => {
    const newPin = await resetStudentPin(s.id)
    showToast(`Nuevo PIN de ${s.name.split(',')[0]}: ${newPin}  — Reimprimir tarjeta`, 'ok')
    setPinVisible(p => ({ ...p, [s.id]: true }))
  }

  const handleDelete = async (s: Student) => {
    if (!confirm(`¿Eliminar a ${s.name}? Sus transacciones se conservan.`)) return
    await softDeleteStudent(s.id)
    showToast('Alumno desactivado', 'ok')
  }

  const handleWriteNFC = async (s: Student) => {
    try {
      await writeNFCTag(s.id)
      showToast(`NFC escrito: ${s.id}`, 'ok')
    } catch (e: any) {
      showToast(e.message, 'err')
    }
  }

  return (
    <div className="min-h-screen bg-sp-bg">
      {/* Nav */}
      <nav className="bg-sp-bg2 border-b border-white/5 px-4 h-14 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">← Panel</Link>
        <span className="text-white/10">|</span>
        <span className="font-semibold text-sm">Gestión de Alumnos</span>
        <span className="text-xs text-slate-700 ml-1">· {groupId} · {students.length} alumnos</span>
        <div className="ml-auto flex gap-2">
          <Link
            href="/students"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300 transition-colors"
          >
            👥 Alumnos
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Add form */}
        {mode === 'add' && (
          <AddStudentForm
            onSubmit={handleCreate}
            onCancel={() => setMode('list')}
          />
        )}

        {/* Edit form */}
        {mode === 'edit' && editing && (
          <EditStudentForm
            student={editing}
            onSubmit={(name) => handleRename(editing.id, name)}
            onCancel={() => { setEditing(null); setMode('list') }}
          />
        )}

        {/* Student list */}
        {mode === 'list' && (
          <>
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-lg font-bold">Alumnos del grupo</h1>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleImportFile(file)
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="flex items-center gap-2 border border-white/10 text-slate-300 px-4 py-2 rounded-lg text-sm font-semibold hover:border-white/20 transition-colors active:scale-95 disabled:opacity-40"
                >
                  {importing ? 'Importando...' : 'Importar Excel'}
                </button>
                <button
                  onClick={() => setMode('add')}
                  className="flex items-center gap-2 bg-sp-gold/15 border border-sp-gold/30 text-sp-gold px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sp-gold/25 transition-colors active:scale-95"
                >
                  + Nuevo alumno
                </button>
              </div>
            </div>

            {importResult && (
              <ImportSummary result={importResult} />
            )}

            {students.length === 0 && (
              <div className="text-center py-16 text-slate-600">
                <div className="text-4xl mb-3">👥</div>
                <p className="font-medium text-slate-400">No hay alumnos aún</p>
                <p className="text-sm mt-1">Agrega el primero con el botón de arriba</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {students.map(s => (
                <StudentRow
                  key={s.id}
                  student={s}
                  pinVisible={pinVisible[s.id] ?? false}
                  onTogglePin={() => setPinVisible(p => ({ ...p, [s.id]: !p[s.id] }))}
                  onEdit={() => { setEditing(s); setMode('edit') }}
                  onResetPin={() => handleResetPin(s)}
                  onWriteNFC={() => handleWriteNFC(s)}
                  onDelete={() => handleDelete(s)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <ToastList toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// ─── STUDENT ROW ──────────────────────────────────────────────────────────────

function StudentRow({
  student: s, pinVisible, onTogglePin, onEdit, onResetPin, onWriteNFC, onDelete,
}: {
  student: Student; pinVisible: boolean
  onTogglePin: () => void; onEdit: () => void
  onResetPin: () => void; onWriteNFC: () => void; onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const lc = LEVEL_COLORS[s.level]

  return (
    <div
      className="rounded-xl border border-white/5 bg-sp-bg2 overflow-hidden"
      style={{ borderColor: menuOpen ? 'rgba(255,255,255,0.1)' : undefined }}
    >
      <div className="flex items-center gap-3 p-3.5">
        <Avatar initials={s.avatar} level={s.level} size={38} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-slate-100">{s.name}</span>
            <LevelBadge level={s.level} />
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="font-mono text-xs text-sp-accent">{s.id}</span>
            <span className="text-xs text-sp-gold font-semibold">{fmtCoins(s.balance)}</span>
            <button
              onClick={onTogglePin}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-400 transition-colors font-mono"
            >
              PIN: {pinVisible ? s.pin : '••••'}
              <span className="text-xs ml-0.5">{pinVisible ? '🙈' : '👁️'}</span>
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ActionIcon title="Escribir NFC" onClick={onWriteNFC}>📡</ActionIcon>
          <ActionIcon title="Editar nombre" onClick={onEdit}>✏️</ActionIcon>
          <div className="relative">
            <ActionIcon title="Más opciones" onClick={() => setMenuOpen(p => !p)}>⋯</ActionIcon>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-sp-bg3 border border-white/10 rounded-xl shadow-2xl py-1 w-44 z-20">
                <MenuItem onClick={() => { onResetPin(); setMenuOpen(false) }} icon="🔑" label="Resetear PIN" />
                <MenuItem onClick={() => { onWriteNFC(); setMenuOpen(false) }} icon="📡" label="Escribir NFC" />
                <div className="h-px bg-white/5 my-1" />
                <MenuItem
                  onClick={() => { onDelete(); setMenuOpen(false) }}
                  icon="🗑️" label="Eliminar alumno"
                  className="text-red-400"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionIcon({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="w-8 h-8 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 flex items-center justify-center text-sm transition-colors"
    >
      {children}
    </button>
  )
}

function MenuItem({ onClick, icon, label, className = '' }: { onClick: () => void; icon: string; label: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/5 transition-colors text-left ${className || 'text-slate-300'}`}
    >
      <span>{icon}</span>{label}
    </button>
  )
}

function ImportSummary({ result }: { result: ImportResult }) {
  return (
    <div className="rounded-xl border border-white/10 bg-sp-bg2 p-4 mb-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold">Resultado de importación</h2>
        <span className="text-xs text-slate-500">
          {result.created.length} creados · {result.failed.length} fallidos
        </span>
      </div>
      {result.created.length > 0 && (
        <div className="max-h-44 overflow-auto rounded-lg bg-sp-bg3 p-3 mb-3">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-xs">
            {result.created.map(s => (
              <div key={s.id} className="contents">
                <span className="text-slate-300 truncate">{s.name}</span>
                <span className="font-mono text-sp-accent">{s.id}</span>
                <span className="font-mono text-sp-gold">{s.pin}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {result.failed.length > 0 && (
        <div className="text-xs text-red-300 space-y-1">
          {result.failed.map((item, idx) => (
            <p key={`${item.name}-${idx}`}>
              <b>{item.name}</b>: {item.error}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

async function readStudentNamesFromSpreadsheet(file: File): Promise<string[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const names = rows
    .map(row => {
      const entries = Object.entries(row)
      const explicit = entries.find(([key]) => /^(nombre|alumno|student|name)$/i.test(key.trim()))
      const value = explicit?.[1] ?? entries[0]?.[1] ?? ''
      return String(value).trim()
    })
    .filter(Boolean)

  return Array.from(new Set(names))
}

function getFirebaseErrorMessage(error: any): string {
  if (error?.code === 'auth/email-already-in-use') return 'ya existe una cuenta con ese ID'
  if (error?.code === 'auth/weak-password') return 'Firebase rechazó la contraseña generada'
  if (error?.message) return error.message
  return 'error desconocido'
}

// ─── ADD FORM ─────────────────────────────────────────────────────────────────

function AddStudentForm({ onSubmit, onCancel }: { onSubmit: (name: string) => Promise<void>; onCancel: () => void }) {
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const preview = name.split(',').map(p => p.trim()[0] ?? '').join('').toUpperCase().slice(0, 2)
  const isValid = name.includes(',') && name.trim().length > 4

  const handle = async () => {
    if (!isValid) { setError('Formato: "Apellido, Nombre"'); return }
    setLoading(true); setError('')
    try { await onSubmit(name.trim()) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="card mb-6 border-sp-gold/20 animate-fade-in">
      <h2 className="font-semibold text-sm mb-4">Nuevo alumno</h2>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-sp-gold/10 border-2 border-sp-gold/30 flex items-center justify-center text-base font-bold text-sp-gold">
          {preview || '?'}
        </div>
        <div className="flex-1">
          <label className="text-xs text-slate-600 block mb-1.5">Nombre completo</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handle()}
            placeholder="García López, Andrea"
            autoFocus
            className="input"
          />
          <p className="text-xs text-slate-700 mt-1">Formato: Apellido(s), Nombre(s)</p>
        </div>
      </div>

      <div className="bg-sp-bg3 rounded-lg p-3 mb-4 text-xs text-slate-600 leading-relaxed">
        El sistema generará automáticamente: ID secuencial · PIN aleatorio de 6 dígitos · Saldo inicial de 100 ₡
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handle}
          disabled={loading || !isValid}
          className="flex-1 bg-sp-gold/15 border border-sp-gold/30 text-sp-gold font-semibold py-2.5 rounded-lg text-sm hover:bg-sp-gold/25 transition-colors disabled:opacity-40"
        >
          {loading ? 'Creando…' : 'Crear alumno'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 border border-white/10 text-slate-500 rounded-lg text-sm hover:border-white/20 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function EditStudentForm({ student, onSubmit, onCancel }: {
  student: Student; onSubmit: (name: string) => Promise<void>; onCancel: () => void
}) {
  const [name, setName]   = useState(student.name)
  const [loading, setLoading] = useState(false)

  return (
    <div className="card mb-6 border-sp-accent/20 animate-fade-in">
      <h2 className="font-semibold text-sm mb-4">Editar nombre — {student.id}</h2>
      <label className="text-xs text-slate-600 block mb-1.5">Nombre</label>
      <input value={name} onChange={e => setName(e.target.value)} className="input mb-4"
        onKeyDown={async e => { if (e.key === 'Enter') { setLoading(true); await onSubmit(name); setLoading(false) } }}
      />
      <div className="flex gap-2">
        <button onClick={async () => { setLoading(true); await onSubmit(name); setLoading(false) }}
          disabled={loading}
          className="flex-1 bg-sp-accent/10 border border-sp-accent/30 text-sp-accent font-semibold py-2.5 rounded-lg text-sm"
        >
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 border border-white/10 text-slate-500 rounded-lg text-sm">
          Cancelar
        </button>
      </div>
    </div>
  )
}
