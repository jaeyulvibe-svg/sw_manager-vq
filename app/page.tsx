"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/portal/sidebar"
import { PortalHeader } from "@/components/portal/portal-header"
import { RoleProvider, useRole } from "@/components/portal/role-context"
import { ThemeProvider } from "@/components/portal/theme-context"
import { ToastProvider } from "@/components/portal/toast"
import { NotificationsProvider } from "@/components/portal/notifications-context"
import { AmbientBackground } from "@/components/portal/ambient-background"
import { CommandPalette } from "@/components/portal/command-palette"
import { isViewAllowed, type ViewKey } from "@/components/portal/nav"
import { DashboardView } from "@/components/pages/dashboard-view"
import { AssetsView } from "@/components/pages/assets-view"
import { EosView } from "@/components/pages/eos-view"
import { LicenseView } from "@/components/pages/license-view"
import { RequestView } from "@/components/pages/request-view"
import { ApprovalView } from "@/components/pages/approval-view"
import { KisaView } from "@/components/pages/kisa-view"
import { PatchView } from "@/components/pages/patch-view"
import { AdminView } from "@/components/pages/admin-view"
import { NotificationsView } from "@/components/pages/notifications-view"

function Portal() {
  const { isAdmin } = useRole()
  const [requestedView, setActive] = useState<ViewKey>("dashboard")
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Fall back to dashboard when the requested view isn't allowed for the active role
  const active = isViewAllowed(requestedView, isAdmin) ? requestedView : "dashboard"

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
      case "license":
        return <LicenseView />
      case "request":
        return <RequestView />
      case "approval":
        return <ApprovalView />
      case "kisa":
        return <KisaView onNavigate={setActive} />
      case "patch":
        return <PatchView onNavigate={setActive} />
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
          "relative z-10 transition-[padding] duration-300",
          collapsed ? "lg:pl-[72px]" : "lg:pl-72",
        )}
      >
        <PortalHeader
          active={active}
          onOpenMobile={() => setMobileOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          onNavigate={setActive}
          onOpenNotifications={() => setActive("notifications")}
        />
        <main className="mx-auto w-full max-w-[104rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
    <ThemeProvider>
      <RoleProvider>
        <ToastProvider>
          <NotificationsProvider>
            <Portal />
          </NotificationsProvider>
        </ToastProvider>
      </RoleProvider>
    </ThemeProvider>
  )
}
