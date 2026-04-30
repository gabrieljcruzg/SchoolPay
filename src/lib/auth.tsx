'use client'

import {
  createContext, useContext, useEffect, useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './firebase'
import { type AuthUser, type UserRole } from '@/types'

interface AuthContextValue {
  user:       AuthUser | null
  firebaseUser: User | null
  loading:    boolean
  isTeacher:  boolean
  isStudent:  boolean
}

const AuthContext = createContext<AuthContextValue>({
  user:         null,
  firebaseUser: null,
  loading:      true,
  isTeacher:    false,
  isStudent:    false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser)
      setLoading(false)
    })
    return unsub
  }, [])

  const teacherEmail = (process.env.NEXT_PUBLIC_TEACHER_EMAIL ?? '').trim().toLowerCase()
  const firebaseEmail = firebaseUser?.email?.trim().toLowerCase() ?? ''

  // Determina el rol según el email:
  // - el docente tiene un email real de Google
  // - los alumnos tienen email del formato {id}@schoolpay.local
  const role: UserRole | null = !firebaseUser
    ? null
    : firebaseEmail === teacherEmail
      ? 'teacher'
      : firebaseEmail.endsWith('@schoolpay.local')
        ? 'student'
        : null

  const user: AuthUser | null = firebaseUser && role
    ? {
        uid:       firebaseUser.uid,
        email:     firebaseUser.email,
        role,
        studentId: role === 'student'
          ? firebaseUser.email!.replace('@schoolpay.local', '').toUpperCase()
          : undefined,
      }
    : null

  return (
    <AuthContext.Provider value={{
      user,
      firebaseUser,
      loading,
      isTeacher: role === 'teacher',
      isStudent: role === 'student',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
