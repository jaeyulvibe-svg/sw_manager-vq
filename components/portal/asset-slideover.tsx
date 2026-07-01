"use client"

import { useEffect } from "react"
import {
  X,
  Server,
  User,
  Building2,
  Tag,
  ShieldAlert,
  PackageCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  BellRing,
} from "lucide-react"
import { StatusBadge, ProgressBar, type Accent } from "./ui"
import { Sparkline } from "./sparkline"
import { useToast } from "./toast"
import { cn } from "@/lib/utils"

export type AssetDetail = {
  id: string
  name: string
  vendor: string
  category: string
  version: string
  latest: string
  server: string
  owner: string
  vuln: "Critical" | "High" | "Medium" | "Low"
  patch: string
  patchAccent: Accent
  vulnAccent: Accent
  eos: string
  eosDaysLeft: number
  approval: string
  approvalAccent: Accent
}

const vulnLabel: Record<AssetDetail["vuln"], string> = {
  Critical: "긴급",
  High: "높음",
  Medium: "보통",
  Low: "낮음",
}

type TimelineItem = {
  date: string
  title: string
  detail: string
  tone: Accent
  icon: typeof CheckCircle2
}

const timeline: TimelineItem[] = [
  {
    date: "오늘 09:12",
    title: "신규 CVE 매핑",
    detail: "CVE-2026-0001 · CVSS 9.8 · 승인 대기",
    tone: "destructive",
    icon: ShieldAlert,
  },
  {
    date: "3일 전",
    title: "자동 수집 스캔 완료",
    detail: "버전/패치 상태 최신화",
    tone: "primary",
    icon: CheckCircle2,
  },
  {
    date: "2주 전",
    title: "보안 패치 적용",
    detail: "1.1.1w → 3.0.13 업그레이드",
    tone: "success",
    icon: PackageCheck,
  },
  {
    date: "1개월 전",
    title: "EOS 정책 검토",
    detail: "연장 지원 계약 검토 필요",
    tone: "eos",
    icon: CalendarClock,
  },
]

export function AssetSlideover({
  asset,
  onClose,
}: {
  asset: AssetDetail | null
  onClose: () => void
}) {
  const { toast } = useToast()

  useEffect(() => {
    if (!asset) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [asset, onClose])

  if (!asset) return null

  const eosPct = Math.max(
    0,
    Math.min(100, Math.round((asset.eosDaysLeft / 1095) * 100)),
  )
  const eosAccent: Accent =
    asset.eosDaysLeft < 180
      ? "destructive"
      : asset.eosDaysLeft < 365
        ? "warning"
        : "success"

  const facts: { icon: typeof Server; label: string; value: string }[] = [
    { icon: Building2, label: "벤더", value: asset.vendor },
    { icon: Tag, label: "분류", value: asset.category },
    { icon: Server, label: "설치 서버", value: asset.server },
    { icon: User, label: "담당자", value: asset.owner },
  ]

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="animate-overlay absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${asset.name} 상세`}
        className="animate-slideover glass absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-primary/25 shadow-2xl"
      >
        {/* Header */}
        <div className="relative flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="glow-card flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <PackageCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="font-mono text-xs text-muted-foreground">
                {asset.id}
              </p>
              <h2 className="text-lg font-bold text-foreground">
                {asset.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                v{asset.version} · 최신 v{asset.latest}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <StatusBadge accent={asset.vulnAccent} pulse={asset.vuln === "Critical"}>
              취약점 {vulnLabel[asset.vuln]}
            </StatusBadge>
            <StatusBadge accent={asset.patchAccent}>{asset.patch}</StatusBadge>
            <StatusBadge accent={asset.approvalAccent}>{asset.approval}</StatusBadge>
          </div>

          {/* Facts grid */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {facts.map((f) => (
              <div
                key={f.label}
                className="rounded-xl border border-border/60 bg-background/40 p-3"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <f.icon className="h-3.5 w-3.5" />
                  {f.label}
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">
                  {f.value}
                </p>
              </div>
            ))}
          </div>

          {/* EOS countdown */}
          <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                EOS 카운트다운
              </span>
              <span className={cn("font-mono text-sm font-bold", `text-${eosAccent}`)}>
                D-{asset.eosDaysLeft}
              </span>
            </div>
            <ProgressBar value={eosPct} accent={eosAccent} />
            <p className="mt-2 text-[11px] text-muted-foreground">
              단종 예정일 <span className="font-mono">{asset.eos}</span>
            </p>
          </div>

          {/* Vulnerability trend */}
          <div className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ShieldAlert className="h-4 w-4" />
              취약점 발생 추이 (최근 7주)
            </div>
            <Sparkline
              data={[2, 3, 1, 4, 3, 5, 4]}
              color="var(--destructive)"
              width={340}
              height={52}
              className="w-full"
            />
          </div>

          {/* Timeline */}
          <div className="mt-6">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              활동 타임라인
            </h3>
            <ul className="flex flex-col">
              {timeline.map((t, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i !== timeline.length - 1 ? (
                    <span className="absolute left-[15px] top-8 h-full w-px bg-border/60" />
                  ) : null}
                  <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background">
                    <t.icon className={cn("h-4 w-4", `text-${t.tone}`)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {t.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {t.date}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 border-t border-border/60 px-5 py-4">
          <button
            type="button"
            onClick={() =>
              toast({
                tone: "success",
                title: "패치 작업 등록 완료",
                description: `${asset.name} 패치 작업이 담당자에게 배정되었습니다.`,
              })
            }
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            <PackageCheck className="h-4 w-4" />
            패치 작업 등록
          </button>
          <button
            type="button"
            onClick={() =>
              toast({
                tone: "info",
                title: "담당자 알림 전송",
                description: `${asset.owner} 담당자에게 알림을 발송했습니다.`,
              })
            }
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
          >
            <BellRing className="h-4 w-4" />
            알림
          </button>
          <button
            type="button"
            onClick={() =>
              toast({
                tone: "info",
                title: "리포트 내보내기",
                description: "자산 상세 리포트(PDF) 생성을 시작했습니다.",
              })
            }
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-foreground transition-colors hover:border-primary/40"
            aria-label="리포트 내보내기"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </div>
  )
}
