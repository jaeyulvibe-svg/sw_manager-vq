"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/portal/sidebar"
import { PortalHeader } from "@/components/portal/portal-header"
import { RoleProvider, useRole } from "@/components/portal/role-context"
import { ToastProvider } from "@/components/portal/toast"
import { NotificationsProvider } from "@/components/portal/notifications-context"
import { AmbientBackground } from "@/components/portal/ambient-background"
import { CommandPalette } from "@/components/portal/command-palette"
import { isViewAllowed, type ViewKey } from "@/components/portal/nav"
import { DashboardView } from "@/components/pages/dashboard-view"
import { AssetsView } from "@/components/pages/assets-view"
import { EosView } from "@/components/pages/eos-view"
import { RequestView } from "@/components/pages/request-view"
import { ApprovalView } from "@/components/pages/approval-view"
import { KisaView } from "@/components/pages/kisa-view"
import { PatchView } from "@/components/pages/patch-view"
import { ManualView } from "@/components/pages/manual-view"
import { AdminView } from "@/components/pages/admin-view"
import { NotificationsView } from "@/components/pages/notifications-view"

function Portal() {
  const { isAdmin } = useRole()
  const [active, setActive] = useState<ViewKey>("dashboard")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

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

  // If the current view is not allowed for the active role, fall back to dashboard
  useEffect(() => {
    if (!isViewAllowed(active, isAdmin)) {
      setActive("dashboard")
    }
  }, [isAdmin, active])

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
      case "patch":
        return <PatchView onNavigate={setActive} />
      case "manual":
        return <ManualView />
      case "admin":
        return <AdminView />
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
      />

      <div className="relative z-10 lg:pl-72">
        <PortalHeader
          active={active}
          onOpenMobile={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          onNavigate={setActive}
          onOpenNotifications={() => setActive("notifications")}
        />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={active} className="animate-view">
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

export default function Home() {
  return (
    <RoleProvider>
      <ToastProvider>
        <NotificationsProvider>
          <Portal />
        </NotificationsProvider>
      </ToastProvider>
    </RoleProvider>
  )
}
