"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/portal/sidebar"
import { PortalHeader } from "@/components/portal/portal-header"
import { RoleProvider, useRole } from "@/components/portal/role-context"
import { ThemeProvider } from "@/components/portal/theme-context"
import { ToastProvider } from "@/components/portal/toast"
import { NotificationsProvider } from "@/components/portal/notifications-context"
import { UnsavedGuardProvider, useUnsavedGuard } from "@/components/portal/unsaved-guard"
import { AmbientBackground } from "@/components/portal/ambient-background"
import { CommandPalette } from "@/components/portal/command-palette"
import { LoginView } from "@/components/portal/login-view"
import { isViewAllowed, type ViewKey } from "@/components/portal/nav"
import { DashboardView } from "@/components/pages/dashboard-view"
import { AssetsView } from "@/components/pages/assets-view"
import { EosView } from "@/components/pages/eos-view"
import { RequestView } from "@/components/pages/request-view"
import { ApprovalView } from "@/components/pages/approval-view"
import { KisaView } from "@/components/pages/kisa-view"
import { VendorView } from "@/components/pages/vendor-view"
import { EosNoticeView } from "@/components/pages/eos-notice-view"
import { PatchView } from "@/components/pages/patch-view"
import { AdminView } from "@/components/pages/admin-view"
import { SwMasterView } from "@/components/pages/sw-master-view"
import { ServersView } from "@/components/pages/servers-view"
import { NotificationsView } from "@/components/pages/notifications-view"

function Portal({ onLogout }: { onLogout: () => void }) {
  const { isAdmin } = useRole()
  const { confirmLeave } = useUnsavedGuard()
  const [requestedView, setActiveRaw] = useState<ViewKey>("dashboard")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Fall back to dashboard when the requested view isn't allowed for the active role
  const active = isViewAllowed(requestedView, isAdmin) ? requestedView : "dashboard"

  // 저장하지 않은 변경사항이 있는 화면에서 벗어날 때 확인을 거친다
  function setActive(next: ViewKey) {
    if (next === active) return
    if (!confirmLeave()) return
    setActiveRaw(next)
  }

  // Global ⌘K / Ctrl+K shortcut for the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function renderView() {
    switch (active) {
      case "dashboard":
        return <DashboardView />
      case "assets":
        return <AssetsView />
      case "eos":
        return <EosView />
      case "request":
        return <RequestView />
      case "approval":
        return <ApprovalView />
      case "kisa":
        return <KisaView onNavigate={setActive} />
      case "vendor":
        return <VendorView onNavigate={setActive} />
      case "eos-notice":
        return <EosNoticeView onNavigate={setActive} />
      case "patch":
        return <PatchView onNavigate={setActive} />
      case "admin-master":
        return <SwMasterView key={active} />
      case "admin-servers":
        return <ServersView />
      case "admin-collect":
        return <AdminView key={active} initialTab="collect" />
      case "admin-policy":
        return <AdminView key={active} initialTab="policy" />
      case "admin-users":
        return <AdminView key={active} initialTab="users" />
      case "notifications":
        return <NotificationsView onNavigate={setActive} />
      default:
        return <DashboardView />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AmbientBackground />

      <Sidebar
        active={active}
        onChange={setActive}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
      />

      <div
        className={cn(
          "relative z-10 min-w-0 overflow-x-hidden transition-[padding] duration-300",
          collapsed ? "lg:pl-[72px]" : "lg:pl-72",
        )}
      >
        <PortalHeader
          active={active}
          onOpenMobile={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          onNavigate={setActive}
          onOpenNotifications={() => setActive("notifications")}
          onLogout={onLogout}
        />
        <main className="mx-auto w-full min-w-0 max-w-[104rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={active} className="min-w-0 animate-view">
            {renderView()}
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={setActive}
      />
    </div>
  )
}

const AUTH_STORAGE_KEY = "sw-manager-auth"

function AuthGate() {
  const [authed, setAuthed] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // 새로고침 시에도 로그인 상태를 유지하기 위해 마운트 후 저장소를 확인한다
    const stored =
      window.localStorage.getItem(AUTH_STORAGE_KEY) ?? window.sessionStorage.getItem(AUTH_STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthed(stored === "1")
    setChecked(true)
  }, [])

  function handleLogin(remember: boolean) {
    if (remember) window.localStorage.setItem(AUTH_STORAGE_KEY, "1")
    else window.sessionStorage.setItem(AUTH_STORAGE_KEY, "1")
    setAuthed(true)
  }

  function handleLogout() {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY)
    setAuthed(false)
  }

  if (!checked) return null
  if (!authed) return <LoginView onLogin={handleLogin} />

  return (
    <RoleProvider>
      <ToastProvider>
        <NotificationsProvider>
          <UnsavedGuardProvider>
            <Portal onLogout={handleLogout} />
          </UnsavedGuardProvider>
        </NotificationsProvider>
      </ToastProvider>
    </RoleProvider>
  )
}

export default function Home() {
  return (
    <ThemeProvider>
      <AuthGate />
    </ThemeProvider>
  )
}
