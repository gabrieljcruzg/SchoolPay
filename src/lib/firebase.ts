import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'firebase/firestore'

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
export const db            = typeof window === 'undefined'
  ? getFirestore(app)
  : initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager({}),
      }),
    })

export default app
