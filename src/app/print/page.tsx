'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth }   from '@/lib/auth'
import { subscribeToStudents } from '@/lib/firestore'
import { Spinner }   from '@/components/ui'
import { LEVEL_COLORS, type Student } from '@/types'
import { GroupSelect } from '@/components/teacher/GroupSelect'
import { useSelectedGroup } from '@/lib/groups'
import Link from 'next/link'

const SCHOOL     = process.env.NEXT_PUBLIC_SCHOOL_NAME ?? 'Secundaria'

export default function PrintPage() {
  const { loading, isTeacher } = useAuth()
  const { groupId, groups, setGroupId } = useSelectedGroup()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isTeacher) router.replace('/')
  }, [loading, isTeacher, router])

  if (loading || !isTeacher) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size={32} /></div>
  }

  return <PrintLayout groupId={groupId} groups={groups} onGroupChange={setGroupId} school={SCHOOL} />
}

function PrintLayout({ groupId, groups, onGroupChange, school }: {
  groupId: string
  groups: string[]
  onGroupChange: (groupId: string) => void
  school: string
}) {
  const [students, setStudents] = useState<Student[]>([])
  const [pinHidden, setPinHidden] = useState(true)  // para el modo "raspadito"
  const [cols, setCols] = useState<2 | 3>(3)        // tarjetas por fila

  useEffect(() => {
    return subscribeToStudents(groupId, setStudents)
  }, [groupId])

  const handlePrint = () => window.print()

  return (
    <>
      {/* ── Controles (no se imprimen) ── */}
      <div className="no-print bg-sp-bg2 border-b border-white/5 px-4 py-3 flex items-center gap-3 flex-wrap sticky top-0 z-10">
        <Link href="/students" className="text-slate-600 hover:text-slate-400 text-sm transition-colors">
          ← Alumnos
        </Link>
        <span className="text-white/10">|</span>
        <span className="font-semibold text-sm">Imprimir tarjetas</span>
        <GroupSelect groupId={groupId} groups={groups} onChange={onGroupChange} />

        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pinHidden}
              onChange={e => setPinHidden(e.target.checked)}
              className="w-3.5 h-3.5 accent-yellow-400"
            />
            Ocultar PIN (raspadito)
          </label>

          <div className="flex gap-1">
            {([2, 3] as const).map(n => (
              <button
                key={n}
                onClick={() => setCols(n)}
                className="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                style={{
                  background:  cols === n ? 'rgba(232,184,75,.15)' : 'transparent',
                  borderColor: cols === n ? 'rgba(232,184,75,.35)' : 'rgba(255,255,255,.1)',
                  color:       cols === n ? '#e8b84b' : '#4b5563',
                }}
              >
                {n} col.
              </button>
            ))}
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-sp-gold text-yellow-950 font-bold px-4 py-2 rounded-lg text-sm hover:bg-sp-gold2 transition-colors active:scale-95"
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {/* ── Instrucciones (no se imprimen) ── */}
      <div className="no-print max-w-2xl mx-auto px-4 py-4">
        <div className="bg-sp-bg2 border border-sp-accent/20 rounded-xl p-4 text-xs text-slate-500 leading-6">
          <strong className="text-slate-300">Instrucciones de impresión:</strong><br/>
          Papel: Hoja carta (Letter). Impresora: a color. Escala: 100% (sin ajustar).<br/>
          Después de imprimir: recortar en línea punteada → plastificar → perforar arriba → agregar cordón o porta-credencial.<br/>
          Cada tarjeta mide exactamente <strong className="text-slate-300">85.6 × 54 mm (CR80)</strong> — tamaño tarjeta de crédito.<br/>
          {pinHidden && <><strong className="text-yellow-400">Modo raspadito activado:</strong> El PIN aparece tapado con un rectángulo gris. Pega un raspadito tipo lotería sobre él antes de entregar.</>}
        </div>
      </div>

      {/* ── Tarjetas imprimibles ── */}
      <div
        id="print-area"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 85.6mm)`,
          gap: '6mm',
          padding: '10mm',
          maxWidth: `${cols * 85.6 + (cols - 1) * 6 + 20}mm`,
          margin: '0 auto',
        }}
      >
        {students.map(s => (
          <PrintCard key={s.id} student={s} school={school} pinHidden={pinHidden} />
        ))}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          #print-area {
            padding: 8mm !important;
            gap: 5mm !important;
          }
        }
        @page {
          size: letter;
          margin: 0;
        }
      `}</style>
    </>
  )
}

// ─── TARJETA INDIVIDUAL (diseño CR80 85.6×54mm) ───────────────────────────────

function PrintCard({ student: s, school, pinHidden }: {
  student: Student; school: string; pinHidden: boolean
}) {
  const lc = LEVEL_COLORS[s.level]

  return (
    <div
      style={{
        width: '85.6mm',
        height: '54mm',
        borderRadius: '3.5mm',
        background: 'linear-gradient(135deg, #1a2d50 0%, #0d1f3c 55%, #0f2240 100%)',
        border: `0.4mm solid ${lc}66`,
        padding: '3.5mm 4mm',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        // Sombra sutil solo en pantalla
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        // Borde de corte
        outline: '0.3mm dashed rgba(200,200,200,0.3)',
        outlineOffset: '1mm',
      }}
    >
      {/* Glow decorativo */}
      <div style={{
        position: 'absolute', top: '-10mm', right: '-10mm',
        width: '30mm', height: '30mm', borderRadius: '50%',
        background: `radial-gradient(circle, ${lc}22 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      {/* Líneas decorativas sutiles */}
      <div style={{
        position: 'absolute', bottom: '-6mm', left: '-4mm',
        width: '50mm', height: '50mm', borderRadius: '50%',
        border: `0.3mm solid ${lc}15`,
        pointerEvents: 'none',
      }} />

      {/* ── TOP ROW ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Logo + nombre escuela */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1.5mm',
          }}>
            <div style={{
              width: '5mm', height: '5mm', borderRadius: '1mm',
              background: 'linear-gradient(135deg, #e8b84b, #f5c842)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '3mm', fontWeight: 900, color: '#1a0e00',
              lineHeight: 1,
            }}>
              ₡
            </div>
            <span style={{ fontSize: '3.5mm', fontWeight: 800, color: '#e8b84b', letterSpacing: '-0.02em' }}>
              SchoolPay
            </span>
          </div>
          <div style={{ fontSize: '2mm', color: 'rgba(255,255,255,0.3)', marginTop: '0.5mm', letterSpacing: '0.05em' }}>
            {school}
          </div>
        </div>

        {/* Nivel + NFC symbol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
          <div style={{
            fontSize: '2mm', fontWeight: 700, color: lc,
            background: `${lc}22`, border: `0.3mm solid ${lc}44`,
            borderRadius: '10mm', padding: '0.5mm 2mm',
          }}>
            {s.level}
          </div>
          {/* NFC arcs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5mm', alignItems: 'flex-end', opacity: 0.6 }}>
            {[4, 6, 8].map(sz => (
              <div key={sz} style={{
                width: `${sz}mm`, height: `${sz / 2}mm`,
                borderRadius: `0 0 ${sz}mm ${sz}mm`,
                border: `0.4mm solid ${lc}`,
                borderTop: 'none',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── CHIP + DATOS CENTRALES ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
        {/* Chip EMV decorativo */}
        <div style={{
          width: '8mm', height: '6mm', flexShrink: 0,
          background: 'linear-gradient(135deg, #c8a94a, #e8c96a)',
          borderRadius: '1mm',
          display: 'grid',
          gridTemplateColumns: '1fr 1px 1fr',
          gridTemplateRows: '1px 1fr 1px 1fr 1px',
          gap: 0, overflow: 'hidden',
        }}>
          {/* Líneas del chip — decorativas */}
          <div style={{ gridColumn: '1/-1', background: '#8a6a20', opacity: 0.5 }} />
          <div /><div style={{ background: '#8a6a20', opacity: 0.5 }} /><div />
          <div style={{ gridColumn: '1/-1', background: '#8a6a20', opacity: 0.5 }} />
          <div /><div style={{ background: '#8a6a20', opacity: 0.5 }} /><div />
          <div style={{ gridColumn: '1/-1', background: '#8a6a20', opacity: 0.5 }} />
        </div>

        {/* ID box */}
        <div style={{
          flex: 1,
          background: 'rgba(232,184,75,0.1)',
          border: '0.3mm solid rgba(232,184,75,0.3)',
          borderRadius: '1.5mm',
          padding: '1mm 2mm',
        }}>
          <div style={{ fontSize: '1.8mm', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>
            ID · USUARIO
          </div>
          <div style={{ fontSize: '4mm', fontWeight: 800, color: '#7dd3fc', fontFamily: 'monospace', letterSpacing: '0.05em', marginTop: '0.5mm' }}>
            {s.id}
          </div>
        </div>

        {/* PIN box */}
        <div style={{
          background: 'rgba(232,184,75,0.1)',
          border: '0.3mm solid rgba(232,184,75,0.3)',
          borderRadius: '1.5mm',
          padding: '1mm 2mm',
          minWidth: '16mm',
          position: 'relative',
        }}>
          <div style={{ fontSize: '1.8mm', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em' }}>PIN</div>
          {pinHidden ? (
            // Rectángulo raspadito
            <div style={{
              marginTop: '0.5mm',
              height: '4.5mm',
              background: '#6b7280',
              borderRadius: '0.8mm',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '1.8mm', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
                ● RASPAR ●
              </span>
            </div>
          ) : (
            <div style={{ fontSize: '4.5mm', fontWeight: 900, color: '#e8b84b', fontFamily: 'monospace', letterSpacing: '0.2em', marginTop: '0.5mm' }}>
              {s.pin}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM ROW — Nombre ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '1.8mm', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', marginBottom: '0.5mm' }}>
            TITULAR
          </div>
          <div style={{ fontSize: '2.8mm', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.05em' }}>
            {s.name.toUpperCase()}
          </div>
        </div>

        {/* QR placeholder — en producción real se generaría el QR del ID */}
        <div style={{
          width: '8mm', height: '8mm',
          background: 'rgba(255,255,255,0.06)',
          border: '0.3mm solid rgba(255,255,255,0.1)',
          borderRadius: '1mm',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2mm', color: 'rgba(255,255,255,0.2)',
        }}>
          QR
        </div>
      </div>
    </div>
  )
}
