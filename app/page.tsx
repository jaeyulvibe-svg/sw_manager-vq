"use client"

import { useState } from "react"
import { Sidebar } from "@/components/portal/sidebar"
import { PortalHeader } from "@/components/portal/portal-header"
import { RoleProvider } from "@/components/portal/role-context"
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

  const ActiveView = VIEWS[active]

  return (
    <RoleProvider>
    <div className="min-h-screen bg-background">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <Sidebar
        active={active}
        onChange={setActive}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="relative lg:pl-72">
        <PortalHeader active={active} onOpenMobile={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={active} className="animate-view">
            <ActiveView />
          </div>
        </main>
      </div>
    </div>
    </RoleProvider>
  )
}
