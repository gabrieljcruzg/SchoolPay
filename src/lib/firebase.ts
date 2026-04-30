import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'

export const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

// App principal — sesión del docente
const app = getApps().find(a => a.name === '[DEFAULT]') ?? initializeApp(firebaseConfig)

// App secundaria — se usa exclusivamente para crear cuentas de alumnos
// sin afectar la sesión activa del docente (createUserWithEmailAndPassword
// hace signIn automático en la app primaria).
const secondaryApp = getApps().find(a => a.name === 'secondary')
  ?? initializeApp(firebaseConfig, 'secondary')

export const auth          = getAuth(app)
export const secondaryAuth = getAuth(secondaryApp)
export const db            = getFirestore(app)

// Habilita persistencia offline (IndexedDB) — esto es lo que permite
// usar la app sin internet. Se llama una sola vez al montar la app.
// El catch es necesario porque falla silenciosamente si ya está habilitada
// o si hay múltiples tabs abiertas (comportamiento esperado).
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Múltiples tabs abiertas — la persistencia solo funciona en una
      console.warn('[SchoolPay] Offline persistence unavailable: multiple tabs open')
    } else if (err.code === 'unimplemented') {
      // El browser no soporta IndexedDB (muy raro en Chrome Android)
      console.warn('[SchoolPay] Offline persistence not supported in this browser')
    }
  })
}

export default app
