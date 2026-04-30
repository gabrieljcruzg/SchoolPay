'use client'

import { useEffect, useMemo, useState } from 'react'

const DEFAULT_GROUPS = ['1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D', '3A', '3B', '3C', '3D', '3E', '3F']
const STORAGE_KEY = 'schoolpay:selected-group'

export function getConfiguredGroups(): string[] {
  const raw = process.env.NEXT_PUBLIC_GROUPS
  const groups = raw
    ? raw.split(',').map(g => g.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_GROUPS

  return Array.from(new Set(groups))
}

export function getDefaultGroup(): string {
  return (process.env.NEXT_PUBLIC_GROUP_NAME ?? getConfiguredGroups()[0] ?? '3A').trim().toUpperCase()
}

export function normalizeGroupId(grade: string, group: string): string {
  return `${grade}${group}`.replace(/\s+/g, '').toUpperCase()
}

export function useSelectedGroup() {
  const groups = useMemo(() => getConfiguredGroups(), [])
  const fallback = groups.includes(getDefaultGroup()) ? getDefaultGroup() : groups[0]
  const [groupId, setGroupIdState] = useState(fallback)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)?.toUpperCase()
    if (stored && groups.includes(stored)) setGroupIdState(stored)
  }, [groups])

  const setGroupId = (next: string) => {
    setGroupIdState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return { groupId, groups, setGroupId }
}
