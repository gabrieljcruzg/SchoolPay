'use client'

import {
  createContext, useContext, useEffect, useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { type AuthUser, type UserRole } from '@/types'

interface AuthContextValue {
  user:       AuthUser | null
  firebaseUser: User | null
  loading:    boolean
  isTeacher:  boolean
  isStudent:  boolean
  isKermesTerminal: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user:         null,
  firebaseUser: null,
  loading:      true,
  isTeacher:    false,
  isStudent:    false,
  isKermesTerminal: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setLoading(true)
      setFirebaseUser(fbUser)
      setUser(await resolveAuthUser(fbUser))
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      loading,
      isTeacher: user?.role === 'teacher',
      isStudent: user?.role === 'student',
      isKermesTerminal: user?.role === 'kermes_vendor' || user?.role === 'kermes_bank',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

async function resolveAuthUser(firebaseUser: User | null): Promise<AuthUser | null> {
  if (!firebaseUser) return null

  const teacherEmail = (process.env.NEXT_PUBLIC_TEACHER_EMAIL ?? '').trim().toLowerCase()
  const firebaseEmail = firebaseUser.email?.trim().toLowerCase() ?? ''

  if (firebaseEmail === teacherEmail) {
    return { uid: firebaseUser.uid, email: firebaseUser.email, role: 'teacher' }
  }

  if (firebaseEmail.endsWith('@schoolpay.local')) {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      role: 'student',
      studentId: firebaseUser.email!.replace('@schoolpay.local', '').toUpperCase(),
    }
  }

  const accessSnap = await getDoc(doc(db, 'kermesAccess', firebaseUser.uid))
  if (accessSnap.exists() && accessSnap.data().active !== false) {
    const access = accessSnap.data()
    const role: UserRole = access.role === 'bank' ? 'kermes_bank' : 'kermes_vendor'
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      role,
      kermesVendorId: access.vendorId,
      kermesAccessName: access.name,
    }
  }

  return null
}
