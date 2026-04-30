// ─── STUDENT ──────────────────────────────────────────────────────────────────

export type Level = 'Novato' | 'Aprendiz' | 'Experto' | 'Élite' | 'Leyenda'

export interface Student {
  id: string           // Ej: "3A-017" — también es el UID de Firebase Auth sin dominio
  name: string         // "García López, Andrea" (apellido, nombre)
  avatar: string       // Iniciales de 2 chars: "AG"
  pin: string          // 6 dígitos — se usa como contraseña en Firebase Auth
  groupId: string      // "3A"
  balance: number      // Saldo actual en EduCoins (nunca < 0)
  totalEarned: number  // Total histórico ganado (determina el nivel)
  level: Level
  streak: number       // Días consecutivos con asistencia + tarea entregada
  badges: string[]     // IDs de insignias obtenidas
  createdAt: Date
}

// ─── TRANSACTION ──────────────────────────────────────────────────────────────

export type TransactionType =
  | 'tarea_tiempo'
  | 'tarea_tarde'
  | 'asistencia'
  | 'participacion'
  | 'examen_9'
  | 'examen_10'
  | 'ayudo_companero'
  | 'reto_extra'
  | 'racha_bonus'
  | 'mision'
  | 'falta_respeto'
  | 'no_tarea'
  | 'celular'
  | 'conducta'
  | 'compra'        // descuento al comprar en tienda
  | 'devolucion'    // reembolso si docente rechaza orden
  | 'manual'        // ajuste manual del docente
  | 'bienvenida'    // saldo inicial

export interface Transaction {
  id: string
  studentId: string
  groupId: string
  amount: number          // positivo = ganó, negativo = perdió
  type: TransactionType
  label: string           // descripción legible
  teacherId: string       // UID del docente que la aplicó
  ts: Date
  reversible: boolean     // permite deshacer en los primeros 60s
}

// ─── QUICK ACTION (configurable por el docente) ───────────────────────────────

export interface QuickAction {
  id: string
  emoji: string
  label: string
  amount: number       // positivo = earn, negativo = lose
  type: 'earn' | 'lose'
  active: boolean
  order: number
}

// ─── STORE ITEM ───────────────────────────────────────────────────────────────

export type StoreCategory = 'daily' | 'academic' | 'premium' | 'group'

export interface StoreItem {
  id: string
  emoji: string
  name: string
  description?: string
  price: number
  stock: number          // 99 = ilimitado en práctica
  maxPerStudent: number  // cuántas puede comprar un alumno por bimestre
  category: StoreCategory
  active: boolean
  requiresApproval: boolean  // siempre true en este sistema
}

// ─── PURCHASE ORDER ───────────────────────────────────────────────────────────

export type OrderStatus = 'pending' | 'approved' | 'rejected'

export interface PurchaseOrder {
  id: string
  studentId: string
  groupId: string
  studentName: string
  studentAvatar: string
  item: Pick<StoreItem, 'id' | 'name' | 'emoji' | 'price'>
  status: OrderStatus
  ts: Date
  resolvedAt?: Date
  teacherNote?: string   // nota del docente al aprobar/rechazar
}

// ─── GROUP ────────────────────────────────────────────────────────────────────

export interface Group {
  id: string           // "3A"
  name: string         // "Tercer Año A"
  teacherId: string
  groupBalance: number // fondo comunitario (se nutre del impuesto P2P y eventos)
  activeEvents: string[]
  createdAt: Date
}

// ─── BADGE ────────────────────────────────────────────────────────────────────

export interface Badge {
  id: string
  emoji: string
  name: string
  description: string
  condition: string  // descripción legible de cómo se obtiene
}

// ─── KERMES ──────────────────────────────────────────────────────────────────

export interface KermesCard {
  id: string
  label: string
  balance: number
  active: boolean
  createdAt: Date
}

export interface KermesVendor {
  id: string
  name: string
  active: boolean
  createdAt: Date
}

export type KermesTransactionType = 'recharge' | 'purchase'

export interface KermesTransaction {
  id: string
  cardId: string
  vendorId?: string
  vendorName?: string
  amount: number
  type: KermesTransactionType
  note?: string
  teacherId: string
  ts: Date
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export type UserRole = 'teacher' | 'student'

export interface AuthUser {
  uid: string
  email: string | null
  role: UserRole
  studentId?: string  // solo si role === 'student'
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export const LEVEL_THRESHOLDS: Record<Level, number> = {
  Novato:   0,
  Aprendiz: 300,
  Experto:  800,
  Élite:    1800,
  Leyenda:  3500,
}

export const LEVEL_COLORS: Record<Level, string> = {
  Novato:   '#64748b',
  Aprendiz: '#4caf82',
  Experto:  '#4fc3f7',
  Élite:    '#e8b84b',
  Leyenda:  '#ab82f5',
}

export function getLevelForTotal(totalEarned: number): Level {
  if (totalEarned >= 3500) return 'Leyenda'
  if (totalEarned >= 1800) return 'Élite'
  if (totalEarned >= 800)  return 'Experto'
  if (totalEarned >= 300)  return 'Aprendiz'
  return 'Novato'
}

export function getLevelProgress(totalEarned: number): { pct: number; toNext: number; nextLevel: Level | null } {
  const level = getLevelForTotal(totalEarned)
  const thresholds = Object.entries(LEVEL_THRESHOLDS) as [Level, number][]
  const currentIdx = thresholds.findIndex(([l]) => l === level)
  const next = thresholds[currentIdx + 1]
  if (!next) return { pct: 100, toNext: 0, nextLevel: null }
  const [nextLevel, nextThreshold] = next
  const prev = LEVEL_THRESHOLDS[level]
  const pct = Math.min(100, ((totalEarned - prev) / (nextThreshold - prev)) * 100)
  return { pct, toNext: nextThreshold - totalEarned, nextLevel }
}

export function fmtCoins(n: number): string {
  return `₡ ${n.toLocaleString('es-MX')}`
}

export function genPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function studentEmail(studentId: string): string {
  return `${studentId.toLowerCase()}@schoolpay.local`
}
