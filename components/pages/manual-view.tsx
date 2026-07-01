"use client"

import {
  Presentation,
  BookOpen,
  ShieldCheck,
  CheckSquare,
  CalendarClock,
  Link2,
  FileBarChart,
  Download,
  FileText,
  FileDown,
} from "lucide-react"
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  MiniButton,
  type Accent,
} from "@/components/portal/ui"

type Manual = {
  title: string
  icon: typeof BookOpen
  accent: Accent
  desc: string
}

const manuals: Manual[] = [
  { title: "SW 자산 등록 가이드", icon: BookOpen, accent: "primary", desc: "신규 자산 등록 및 마스터 편입 절차" },
  { title: "취약점 공지 확인 절차", icon: ShieldCheck, accent: "destructive", desc: "KISA·제조사 공지 수집 및 매핑 방법" },
  { title: "패치 승인 프로세스", icon: CheckSquare, accent: "success", desc: "패치 검토 → 승인 → 적용 단계" },
  { title: "EOS/EOL 대응 기준", icon: CalendarClock, accent: "eos", desc: "지원 종료 자산 관리 및 마이그레이션" },
  { title: "자동수집 Source URL 등록 방법", icon: Link2, accent: "warning", desc: "공식 Source 등록 및 수집 주기 설정" },
  { title: "월간 자산·보안 보고서", icon: FileBarChart, accent: "primary", desc: "월간 통계 및 조치 현황 리포트" },
]

type Doc = {
  name: string
  type: string
  version: string
  author: string
  updated: string
}

const docs: Doc[] = [
  { name: "SW 자산관리 운영 매뉴얼", type: "PPT", version: "v1.0", author: "관리자", updated: "오늘" },
  { name: "취약점·패치 승인 프로세스", type: "PPT", version: "v1.2", author: "보안팀", updated: "어제" },
  { name: "EOS 대응 가이드", type: "PPT", version: "v1.1", author: "인프라팀", updated: "2026-06-25" },
]

const reportItems = [
  { label: "전체 SW 자산 현황", value: "14,829건", accent: "primary" as Accent },
  { label: "신규 취약점 요약", value: "342건", accent: "destructive" as Accent },
  { label: "패치 승인 현황", value: "승인 128 · 대기 5", accent: "success" as Accent },
  { label: "EOS 임박 자산", value: "87건", accent: "eos" as Accent },
  { label: "담당자별 조치율", value: "평균 78%", accent: "warning" as Accent },
]

export function ManualView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Presentation}
        title="소프트웨어 매뉴얼(PPT)"
        description="SW 자산 관리 기준, 취약점 대응 절차, 패치 승인 프로세스, EOS 관리 기준을 문서화하여 제공합니다."
      />

      {/* Manual cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {manuals.map((m, i) => (
          <div
            key={m.title}
            className="glow-card animate-rise group flex flex-col rounded-2xl border border-border/60 bg-card p-5 transition-transform hover:-translate-y-1"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 text-primary transition-transform group-hover:scale-110">
                <m.icon className="h-5 w-5" />
              </span>
              <StatusBadge accent={m.accent}>PPT</StatusBadge>
            </div>
            <h3 className="text-sm font-bold text-foreground">{m.title}</h3>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
              {m.desc}
            </p>
            <button
              type="button"
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/50 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Download className="h-3.5 w-3.5" />
              다운로드
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* PPT list */}
        <div className="lg:col-span-3">
          <SectionCard title="문서 목록" subtitle="등록된 매뉴얼·프로세스 문서" icon={FileText}>
            <TableShell>
              <thead>
                <tr>
                  <Th>문서명</Th>
                  <Th>유형</Th>
                  <Th>버전</Th>
                  <Th>작성자</Th>
                  <Th>최근 수정일</Th>
                  <Th>다운로드</Th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.name} className="transition-colors hover:bg-accent/40">
                    <Td className="font-semibold">{d.name}</Td>
                    <Td><StatusBadge accent="primary">{d.type}</StatusBadge></Td>
                    <Td className="font-mono text-xs">{d.version}</Td>
                    <Td className="text-muted-foreground">{d.author}</Td>
                    <Td className="text-xs text-muted-foreground">{d.updated}</Td>
                    <Td>
                      <MiniButton accent="success"><Download className="h-3 w-3" />다운로드</MiniButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </SectionCard>
        </div>

        {/* Monthly report */}
        <div className="lg:col-span-2">
          <SectionCard
            title="월간 보고서 미리보기"
            subtitle="2026년 7월 자산·보안 리포트"
            icon={FileBarChart}
          >
            <ul className="flex flex-col gap-2.5">
              {reportItems.map((r) => (
                <li
                  key={r.label}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background/40 px-3 py-2.5"
                >
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <StatusBadge accent={r.accent}>{r.value}</StatusBadge>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="glow-card mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/15 py-2.5 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5"
            >
              <FileDown className="h-4 w-4" />
              월간 보고서 PDF 생성
            </button>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
