"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/portal/sidebar"
import { PortalHeader } from "@/components/portal/portal-header"
import { RoleProvider } from "@/components/portal/role-context"
import { ToastProvider } from "@/components/portal/toast"
import { AmbientBackground } from "@/components/portal/ambient-background"
import { CommandPalette } from "@/components/portal/command-palette"
import { type ViewKey } from "@/components/portal/nav"
import { DashboardView } from "@/components/pages/dashboard-view"
import { AssetsView } from "@/components/pages/assets-view"
import { EosView } from "@/components/pages/eos-view"
import { RequestView } from "@/components/pages/request-view"
import { KisaView } from "@/components/pages/kisa-view"
import { OwnerView } from "@/components/pages/owner-view"
import { ManualView } from "@/components/pages/manual-view"
import { AdminView } from "@/components/pages/admin-view"

const VIEWS: Record<ViewKey, () => React.ReactNode> = {
  dashboard: DashboardView,
  assets: AssetsView,
  eos: EosView,
  request: RequestView,
  kisa: KisaView,
  owner: OwnerView,
  manual: ManualView,
  admin: AdminView,
}

export default function Home() {
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

  const ActiveView = VIEWS[active]

  return (
    <RoleProvider>
      <ToastProvider>
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
            />
            <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <div key={active} className="animate-view">
                <ActiveView />
              </div>
            </main>
          </div>

          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onNavigate={setActive}
          />
        </div>
      </ToastProvider>
    </RoleProvider>
  )
}
