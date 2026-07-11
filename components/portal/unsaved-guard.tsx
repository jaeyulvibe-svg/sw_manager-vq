"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

const UNSAVED_MESSAGE = "저장하지 않은 변경사항이 있습니다.\n페이지를 나가시겠습니까?"

type UnsavedGuardContextValue = {
  /** 현재 화면에 저장하지 않은 변경사항이 있는지 등록/해제한다. */
  setDirty: (dirty: boolean) => void
  /** 뷰 전환 등 이탈 동작 전에 호출 — 변경사항이 있으면 confirm을 띄우고, 계속 진행해도 되면 true를 반환한다. */
  confirmLeave: () => boolean
}

const UnsavedGuardContext = createContext<UnsavedGuardContextValue | null>(null)

export function UnsavedGuardProvider({ children }: { children: React.ReactNode }) {
  const [dirty, setDirtyState] = useState(false)
  const dirtyRef = useRef(false)

  const setDirty = useCallback((next: boolean) => {
    dirtyRef.current = next
    setDirtyState(next)
  }, [])

  const confirmLeave = useCallback(() => {
    if (!dirtyRef.current) return true
    return window.confirm(UNSAVED_MESSAGE)
  }, [])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  return (
    <UnsavedGuardContext.Provider value={{ setDirty, confirmLeave }}>
      {children}
    </UnsavedGuardContext.Provider>
  )
}

export function useUnsavedGuard() {
  const ctx = useContext(UnsavedGuardContext)
  if (!ctx) throw new Error("useUnsavedGuard must be used within UnsavedGuardProvider")
  return ctx
}
