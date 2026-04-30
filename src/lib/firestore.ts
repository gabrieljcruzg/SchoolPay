/**
 * firestore.ts — Capa de acceso a datos
 * Todas las operaciones de lectura/escritura pasan por aquí.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  addDoc, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, writeBatch, increment,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  updatePassword,
  signOut,
} from 'firebase/auth'
import { db, auth, secondaryAuth } from './firebase'
import {
  type Student, type Transaction, type QuickAction,
  type StoreItem, type PurchaseOrder, type OrderStatus,
  type KermesCard, type KermesVendor, type KermesTransaction,
  getLevelForTotal, genPin, studentEmail,
} from '@/types'

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export async function teacherSignIn() {
  const provider = new GoogleAuthProvider()

  try {
    return await signInWithPopup(auth, provider)
  } catch (e: any) {
    if (e.code === 'auth/popup-blocked') {
      return signInWithRedirect(auth, provider)
    }
    throw e
  }
}

export async function studentSignIn(studentId: string, pin: string) {
  return signInWithEmailAndPassword(auth, studentEmail(studentId), pin)
}

export async function signOutUser() {
  return signOut(auth)
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

export async function createStudent(data: { name: string; groupId: string }): Promise<Student> {
  const snap = await getDocs(
    query(collection(db, 'students'), where('groupId', '==', data.groupId))
  )
  const num   = String(snap.size + 1).padStart(3, '0')
  const id    = `${data.groupId}-${num}`
  const pin   = genPin()
  const email = studentEmail(id)
  const avatar = data.name.split(',').map(p => p.trim()[0] ?? '').join('').toUpperCase().slice(0, 2)

  // Crea la cuenta usando la app SECUNDARIA para no desloguear al docente
  await createUserWithEmailAndPassword(secondaryAuth, email, pin)
  await secondaryAuth.signOut()

  const student: Student = {
    id, name: data.name, avatar, pin, groupId: data.groupId,
    balance: 100, totalEarned: 100, level: 'Novato',
    streak: 0, badges: [], createdAt: new Date(),
  }

  const batch = writeBatch(db)
  batch.set(doc(db, 'students', id), { ...student, createdAt: serverTimestamp() })
  const txRef = doc(collection(db, 'transactions'))
  batch.set(txRef, {
    studentId: id, amount: 100, type: 'bienvenida',
    label: '¡Bienvenido a SchoolPay!', teacherId: 'system',
    groupId: data.groupId,
    reversible: false, ts: serverTimestamp(),
  })
  await batch.commit()
  return student
}

export async function updateStudentName(studentId: string, name: string): Promise<void> {
  const avatar = name.split(',').map(p => p.trim()[0] ?? '').join('').toUpperCase().slice(0, 2)
  await updateDoc(doc(db, 'students', studentId), { name, avatar })
}

export async function resetStudentPin(studentId: string): Promise<string> {
  const student = await getStudent(studentId)
  if (!student) throw new Error('Alumno no encontrado')

  const newPin = genPin()
  await signInWithEmailAndPassword(secondaryAuth, studentEmail(studentId), student.pin)
  if (!secondaryAuth.currentUser) throw new Error('No se pudo autenticar al alumno para cambiar el PIN')
  await updatePassword(secondaryAuth.currentUser, newPin)
  await secondaryAuth.signOut()

  await updateDoc(doc(db, 'students', studentId), { pin: newPin })
  return newPin
}

export async function softDeleteStudent(studentId: string): Promise<void> {
  await updateDoc(doc(db, 'students', studentId), { active: false })
}

export function subscribeToStudents(
  groupId: string,
  callback: (students: Student[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'students'),
    where('groupId', '==', groupId),
    orderBy('name'),
  )
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs
        .map(d => ({ ...d.data(), id: d.id, createdAt: d.data().createdAt?.toDate() ?? new Date() }) as Student)
        .filter(s => (s as any).active !== false)
    )
  })
}

export async function getStudent(studentId: string): Promise<Student | null> {
  const snap = await getDoc(doc(db, 'students', studentId))
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as Student) : null
}

export function subscribeToStudent(
  studentId: string,
  callback: (s: Student | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'students', studentId), snap => {
    callback(snap.exists() ? ({ ...snap.data(), id: snap.id } as Student) : null)
  })
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

export async function addTransaction(tx: {
  studentId: string; amount: number; type: Transaction['type']
  label: string; teacherId: string; reversible?: boolean
}): Promise<string> {
  const student = await getStudent(tx.studentId)
  if (!student) throw new Error(`Alumno ${tx.studentId} no encontrado`)

  const newBalance     = Math.max(0, student.balance + tx.amount)
  const newTotalEarned = tx.amount > 0 ? student.totalEarned + tx.amount : student.totalEarned
  const newLevel       = getLevelForTotal(newTotalEarned)

  const batch  = writeBatch(db)
  const txRef  = doc(collection(db, 'transactions'))

  batch.update(doc(db, 'students', tx.studentId), {
    balance: newBalance, totalEarned: newTotalEarned, level: newLevel,
  })
  batch.set(txRef, {
    ...tx, reversible: tx.reversible ?? true, ts: serverTimestamp(),
    groupId: student.groupId,
  })
  await batch.commit()
  return txRef.id
}

export async function reverseTransaction(txId: string, teacherId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'transactions', txId))
  if (!snap.exists()) throw new Error('Transacción no encontrada')
  const tx = snap.data() as Transaction
  if (!tx.reversible) throw new Error('No se puede revertir')
  await addTransaction({
    studentId: tx.studentId, amount: -tx.amount, type: 'manual',
    label: `↩ Reversión: ${tx.label}`, teacherId, reversible: false,
  })
  await updateDoc(doc(db, 'transactions', txId), { reversible: false })
}

export function subscribeToTransactions(
  groupId: string, limitN: number,
  callback: (txs: Transaction[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'transactions'),
    where('groupId', '==', groupId),
    orderBy('ts', 'desc'),
    limit(limitN),
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      ...d.data(), id: d.id, ts: d.data().ts?.toDate() ?? new Date(),
    })) as Transaction[])
  })
}

export function subscribeToStudentTransactions(
  studentId: string,
  callback: (txs: Transaction[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'transactions'),
    where('studentId', '==', studentId),
    orderBy('ts', 'desc'), limit(20),
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      ...d.data(), id: d.id, ts: d.data().ts?.toDate() ?? new Date(),
    })) as Transaction[])
  })
}

// ─── QUICK ACTIONS ────────────────────────────────────────────────────────────

export function subscribeToQuickActions(
  groupId: string,
  callback: (actions: QuickAction[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'quickActions'),
    where('groupId', '==', groupId),
    orderBy('order'),
  )
  return onSnapshot(q, async snap => {
    if (snap.empty) { await seedDefaultActions(groupId); return }
    callback(
      snap.docs
        .map(d => ({ ...d.data(), id: d.id }) as QuickAction)
        .filter(action => action.active !== false)
    )
  })
}

export async function saveQuickAction(groupId: string, action: Omit<QuickAction, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'quickActions'), { ...action, groupId })
  return ref.id
}

export async function updateQuickAction(id: string, data: Partial<QuickAction>): Promise<void> {
  await updateDoc(doc(db, 'quickActions', id), data)
}

export async function deleteQuickAction(id: string): Promise<void> {
  await updateDoc(doc(db, 'quickActions', id), { active: false })
}

// ─── STORE ────────────────────────────────────────────────────────────────────

export function subscribeToStoreItems(
  groupId: string,
  callback: (items: StoreItem[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'storeItems'),
    where('groupId', '==', groupId),
    where('active', '==', true),
    orderBy('price'),
  )
  return onSnapshot(q, async snap => {
    if (snap.empty) { await seedDefaultStore(groupId); return }
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id })) as StoreItem[])
  })
}

export async function saveStoreItem(groupId: string, item: Omit<StoreItem, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'storeItems'), { ...item, groupId })
  return ref.id
}

export async function updateStoreItem(id: string, data: Partial<StoreItem>): Promise<void> {
  await updateDoc(doc(db, 'storeItems', id), data)
}

// ─── ORDERS ───────────────────────────────────────────────────────────────────

export async function placeOrder(student: Student, item: StoreItem): Promise<string> {
  if (student.balance < item.price) throw new Error('Saldo insuficiente')

  const batch = writeBatch(db)
  batch.update(doc(db, 'students', student.id), { balance: student.balance - item.price })
  if (item.stock < 99) {
    batch.update(doc(db, 'storeItems', item.id), { stock: increment(-1) })
  }
  const orderRef = doc(collection(db, 'orders'))
  batch.set(orderRef, {
    studentId: student.id, studentName: student.name, studentAvatar: student.avatar,
    groupId: student.groupId,
    item: { id: item.id, name: item.name, emoji: item.emoji, price: item.price },
    status: 'pending' as OrderStatus,
    ts: serverTimestamp(), resolvedAt: null, teacherNote: null,
  })
  const txRef = doc(collection(db, 'transactions'))
  batch.set(txRef, {
    studentId: student.id, amount: -item.price, type: 'compra',
    label: `Compra: ${item.name}`, teacherId: 'student',
    groupId: student.groupId,
    reversible: false, ts: serverTimestamp(),
  })
  await batch.commit()
  return orderRef.id
}

export async function resolveOrder(
  orderId: string, status: 'approved' | 'rejected',
  teacherId: string, teacherNote?: string,
): Promise<void> {
  const snap = await getDoc(doc(db, 'orders', orderId))
  if (!snap.exists()) throw new Error('Orden no encontrada')
  const order = snap.data() as PurchaseOrder

  const batch = writeBatch(db)
  batch.update(doc(db, 'orders', orderId), {
    status, resolvedAt: serverTimestamp(), teacherNote: teacherNote ?? null,
  })
  if (status === 'rejected') {
    batch.update(doc(db, 'students', order.studentId), { balance: increment(order.item.price) })
    batch.set(doc(collection(db, 'transactions')), {
      studentId: order.studentId, amount: order.item.price, type: 'devolucion',
      label: `Devolución: ${order.item.name}`, teacherId,
      groupId: (order as any).groupId,
      reversible: false, ts: serverTimestamp(),
    })
    const itemSnap = await getDoc(doc(db, 'storeItems', order.item.id))
    if (itemSnap.exists() && itemSnap.data().stock < 99) {
      batch.update(doc(db, 'storeItems', order.item.id), { stock: increment(1) })
    }
  }
  await batch.commit()
}

export function subscribeToOrders(
  groupId: string,
  callback: (orders: PurchaseOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'orders'),
    where('groupId', '==', groupId),
    orderBy('ts', 'desc'),
    limit(60),
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      ...d.data(), id: d.id,
      ts:         d.data().ts?.toDate()         ?? new Date(),
      resolvedAt: d.data().resolvedAt?.toDate() ?? undefined,
    })) as PurchaseOrder[])
  })
}

export function subscribeToStudentOrders(
  studentId: string,
  callback: (orders: PurchaseOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'orders'),
    where('studentId', '==', studentId),
    orderBy('ts', 'desc'), limit(20),
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      ...d.data(), id: d.id,
      ts:         d.data().ts?.toDate()         ?? new Date(),
      resolvedAt: d.data().resolvedAt?.toDate() ?? undefined,
    })) as PurchaseOrder[])
  })
}

// ─── SEEDERS ──────────────────────────────────────────────────────────────────

async function seedDefaultActions(groupId: string) {
  const defaults: Omit<QuickAction, 'id'>[] = [
    { emoji: '📝', label: 'Tarea entregada',      amount:  50,  type: 'earn', active: true, order: 0 },
    { emoji: '✅', label: 'Asistencia puntual',   amount:  15,  type: 'earn', active: true, order: 1 },
    { emoji: '🙋', label: 'Participación',        amount:  25,  type: 'earn', active: true, order: 2 },
    { emoji: '🧠', label: 'Examen ≥ 9',           amount: 100,  type: 'earn', active: true, order: 3 },
    { emoji: '🤝', label: 'Ayudó a compañero',    amount:  30,  type: 'earn', active: true, order: 4 },
    { emoji: '⚡', label: 'Reto extra',           amount:  80,  type: 'earn', active: true, order: 5 },
    { emoji: '🚫', label: 'Falta de respeto',     amount: -80,  type: 'lose', active: true, order: 6 },
    { emoji: '❌', label: 'No entregó tarea',     amount: -30,  type: 'lose', active: true, order: 7 },
    { emoji: '📵', label: 'Celular sin permiso',  amount: -25,  type: 'lose', active: true, order: 8 },
    { emoji: '⚠️', label: 'Conducta disruptiva',  amount: -40,  type: 'lose', active: true, order: 9 },
  ]
  const batch = writeBatch(db)
  defaults.forEach(a => batch.set(doc(collection(db, 'quickActions')), { ...a, groupId }))
  await batch.commit()
}

async function seedDefaultStore(groupId: string) {
  const defaults: Omit<StoreItem, 'id'>[] = [
    { emoji: '🎵', name: 'Escuchar música (audífonos)',      price: 100, stock: 99, maxPerStudent: 99, category: 'daily',    active: true, requiresApproval: true },
    { emoji: '💺', name: 'Elegir lugar en el salón',         price: 120, stock:  5, maxPerStudent:  2, category: 'daily',    active: true, requiresApproval: true },
    { emoji: '📝', name: 'Saltarse una tarea',               price: 150, stock:  2, maxPerStudent:  2, category: 'academic', active: true, requiresApproval: true },
    { emoji: '⏰', name: 'Tiempo extra en examen (+10 min)', price: 200, stock:  1, maxPerStudent:  1, category: 'academic', active: true, requiresApproval: true },
    { emoji: '📅', name: 'Cambiar fecha de entrega',         price: 180, stock:  3, maxPerStudent:  3, category: 'academic', active: true, requiresApproval: true },
    { emoji: '⭐', name: '+0.5 pts en tarea',                price: 250, stock:  1, maxPerStudent:  1, category: 'academic', active: true, requiresApproval: true },
    { emoji: '✅', name: 'Tarea automática (10/10)',         price: 350, stock:  1, maxPerStudent:  1, category: 'premium',  active: true, requiresApproval: true },
    { emoji: '🎤', name: 'Ser el maestro 15 min',            price: 500, stock:  1, maxPerStudent:  1, category: 'premium',  active: true, requiresApproval: true },
    { emoji: '🌟', name: 'Punto extra en examen parcial',    price: 600, stock:  1, maxPerStudent:  1, category: 'premium',  active: true, requiresApproval: true },
  ]
  const batch = writeBatch(db)
  defaults.forEach(item => batch.set(doc(collection(db, 'storeItems')), { ...item, groupId }))
  await batch.commit()
}

// ─── KERMES ──────────────────────────────────────────────────────────────────

export function subscribeToKermesCards(callback: (cards: KermesCard[]) => void): Unsubscribe {
  const q = query(collection(db, 'kermesCards'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    callback(
      snap.docs
        .map(d => ({ ...d.data(), id: d.id, createdAt: d.data().createdAt?.toDate() ?? new Date() }) as KermesCard)
        .filter(card => card.active !== false)
    )
  })
}

export async function createKermesCard(label: string): Promise<KermesCard> {
  const ref = doc(collection(db, 'kermesCards'))
  const card: Omit<KermesCard, 'createdAt'> = {
    id: `K-${ref.id.slice(0, 8).toUpperCase()}`,
    label,
    balance: 0,
    active: true,
  }
  await setDoc(ref, { ...card, createdAt: serverTimestamp() })
  return { ...card, createdAt: new Date() }
}

export async function rechargeKermesCard(cardId: string, amount: number, teacherId: string, note?: string): Promise<void> {
  if (amount <= 0) throw new Error('La recarga debe ser mayor a cero')
  const card = await findKermesCardByPublicId(cardId)
  if (!card) throw new Error('Tarjeta no encontrada')

  const batch = writeBatch(db)
  batch.update(doc(db, 'kermesCards', card.docId), { balance: increment(amount) })
  batch.set(doc(collection(db, 'kermesTransactions')), {
    cardId: card.publicId,
    amount,
    type: 'recharge',
    note: note ?? null,
    teacherId,
    ts: serverTimestamp(),
  })
  await batch.commit()
}

export async function chargeKermesCard(cardId: string, vendor: KermesVendor, amount: number, teacherId: string, note?: string): Promise<void> {
  if (amount <= 0) throw new Error('El cobro debe ser mayor a cero')
  const card = await findKermesCardByPublicId(cardId)
  if (!card) throw new Error('Tarjeta no encontrada')
  if (card.balance < amount) throw new Error('Saldo insuficiente')

  const batch = writeBatch(db)
  batch.update(doc(db, 'kermesCards', card.docId), { balance: increment(-amount) })
  batch.set(doc(collection(db, 'kermesTransactions')), {
    cardId: card.publicId,
    vendorId: vendor.id,
    vendorName: vendor.name,
    amount: -amount,
    type: 'purchase',
    note: note ?? null,
    teacherId,
    ts: serverTimestamp(),
  })
  await batch.commit()
}

export function subscribeToKermesVendors(callback: (vendors: KermesVendor[]) => void): Unsubscribe {
  const q = query(collection(db, 'kermesVendors'), orderBy('name'))
  return onSnapshot(q, snap => {
    callback(
      snap.docs
        .map(d => ({ ...d.data(), id: d.id, createdAt: d.data().createdAt?.toDate() ?? new Date() }) as KermesVendor)
        .filter(vendor => vendor.active !== false)
    )
  })
}

export async function createKermesVendor(name: string): Promise<void> {
  await addDoc(collection(db, 'kermesVendors'), {
    name,
    active: true,
    createdAt: serverTimestamp(),
  })
}

export async function deleteKermesVendor(id: string): Promise<void> {
  await updateDoc(doc(db, 'kermesVendors', id), { active: false })
}

export function subscribeToKermesTransactions(callback: (txs: KermesTransaction[]) => void): Unsubscribe {
  const q = query(collection(db, 'kermesTransactions'), orderBy('ts', 'desc'), limit(80))
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({
      ...d.data(),
      id: d.id,
      ts: d.data().ts?.toDate() ?? new Date(),
    })) as KermesTransaction[])
  })
}

async function findKermesCardByPublicId(cardId: string): Promise<(KermesCard & { docId: string; publicId: string }) | null> {
  const publicId = cardId.trim().toUpperCase()
  const snap = await getDocs(query(collection(db, 'kermesCards'), where('id', '==', publicId), limit(1)))
  const docSnap = snap.docs[0]
  if (!docSnap) return null
  const data = docSnap.data()
  return {
    ...data,
    id: data.id,
    publicId: data.id,
    docId: docSnap.id,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  } as KermesCard & { docId: string; publicId: string }
}
