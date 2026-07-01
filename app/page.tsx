import { TopBar } from "@/components/dashboard/top-bar"
import { ScanHero } from "@/components/dashboard/scan-hero"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { CriticalAlerts } from "@/components/dashboard/critical-alerts"
import {
  VulnerabilityTrend,
  SeverityDonut,
  PatchByOs,
} from "@/components/dashboard/charts"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <TopBar />
        <ScanHero />
        <KpiCards />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <VulnerabilityTrend />
          <SeverityDonut />
          <PatchByOs />
        </div>

        <CriticalAlerts />
      </main>
    </div>
  )
}
