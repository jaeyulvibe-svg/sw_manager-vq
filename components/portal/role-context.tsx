"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"

export type AppUserRow = Tables<"app_users">

const ROLE_RANK: Record<AppUserRow["role"], number> = {
  관리자: 0,
  담당자: 1,
  "조회 사용자": 2,
}

const CURRENT_USER_STORAGE_KEY = "sw-manager-current-user-id"

type RoleContextValue = {
  currentUser: AppUserRow | null
  users: AppUserRow[]
  loading: boolean
  setCurrentUserId: (id: string) => void
  isAdmin: boolean
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AppUserRow[]>([])
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("app_users")
      .select("*")
      .eq("active", true)
      .then(({ data }) => {
        if (data) {
          const sorted = [...data].sort((a, b) => {
            const rankDiff = ROLE_RANK[a.role] - ROLE_RANK[b.role]
            return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name, "ko")
          })
          setUsers(sorted)
          const storedId = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY)
          const initial = sorted.find((u) => u.id === storedId) ?? sorted[0] ?? null
          setCurrentUserIdState(initial?.id ?? null)
        }
        setLoading(false)
      })
  }, [])

  const setCurrentUserId = useCallback((id: string) => {
    setCurrentUserIdState(id)
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, id)
  }, [])

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? null,
    [users, currentUserId],
  )

  const value = useMemo<RoleContextValue>(
    () => ({
      currentUser,
      users,
      loading,
      setCurrentUserId,
      isAdmin: currentUser?.role === "관리자",
    }),
    [currentUser, users, loading, setCurrentUserId],
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used within RoleProvider")
  return ctx
}
