"use client"

import { useState } from "react"
import {
  FilePlus2,
  Save,
  Send,
  Paperclip,
  ClipboardList,
  Clock3,
  CircleCheck,
  CircleX,
} from "lucide-react"
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  type Accent,
} from "@/components/portal/ui"
import { cn } from "@/lib/utils"

const CATEGORIES = ["OS", "WEB", "WAS", "DB", "Middleware", "Security"]
const MODES = ["AUTO", "SEMI_AUTO", "MANUAL"] as const

type Approval = "승인대기" | "승인완료" | "반려"

type Req = {
  no: string
  name: string
  vendor: string
  requester: string
  date: string
  approval: Approval
  comment: string
}

const requests: Req[] = [
  { no: "REQ-2026-001", name: "Apache Tomcat", vendor: "Apache", requester: "홍길동", date: "오늘", approval: "승인대기", comment: "검토중" },
  { no: "REQ-2026-002", name: "PostgreSQL", vendor: "PostgreSQL Global Development Group", requester: "김철수", date: "어제", approval: "승인완료", comment: "등록 완료" },
  { no: "REQ-2026-003", name: "Nginx", vendor: "F5", requester: "이영희", date: "어제", approval: "반려", comment: "Source URL 확인 필요" },
]

const approvalAccent: Record<Approval, Accent> = {
  승인대기: "warning", 승인완료: "success", 반려: "destructive",
}

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </span>
      {children}
    </label>
  )
}

const inputCls =
  "w-full rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/20"

export function RequestView() {
  const [mode, setMode] = useState<(typeof MODES)[number]>("AUTO")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={FilePlus2}
        title="신규 자산 요청"
        description="사용자가 신규 SW 자산 등록을 요청하고, 관리자가 승인 후 공식 관리 대상으로 등록합니다."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="승인 대기" value={5} icon={Clock3} accent="warning" delay={80} />
        <StatCard label="승인 완료" value={38} icon={CircleCheck} accent="success" delay={180} />
        <StatCard label="반려" value={2} icon={CircleX} accent="destructive" delay={280} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3">
          <SectionCard title="신규 자산 등록 요청서" subtitle="필수 항목을 입력해 주세요" icon={FilePlus2}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="제품명" required>
                <input className={inputCls} placeholder="예: Apache Tomcat" />
              </Field>
              <Field label="벤더" required>
                <input className={inputCls} placeholder="예: Apache" />
              </Field>
              <Field label="분류" required>
                <select className={inputCls} defaultValue="WAS">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="버전" required>
                <input className={inputCls} placeholder="예: 10.1.24" />
              </Field>
              <Field label="설치 서버">
                <input className={inputCls} placeholder="예: WAS-PRD-03" />
              </Field>
              <Field label="사용 부서">
                <input className={inputCls} placeholder="예: WAS운영팀" />
              </Field>
              <Field label="담당자" required>
                <input className={inputCls} placeholder="예: 홍길동" />
              </Field>
              <Field label="공식 Source URL">
                <input className={inputCls} placeholder="https://vendor.com/security" />
              </Field>
            </div>

            <div className="mt-4">
              <span className="text-xs font-medium text-muted-foreground">수집 모드</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      mode === m
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <Field label="요청 사유">
                <textarea rows={3} className={inputCls} placeholder="신규 도입 배경 및 사용 목적을 입력하세요" />
              </Field>
              <Field label="첨부 파일">
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-background/40 px-3 py-3 text-sm text-muted-foreground">
                  <Paperclip className="h-4 w-4" />
                  구성도 / 도입 계획서 등을 첨부하세요
                </div>
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <Save className="h-4 w-4" />
                임시저장
              </button>
              <button type="button" className="glow-card inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-4 py-2 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5">
                <Send className="h-4 w-4" />
                등록 요청
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Approval status cards */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <SectionCard title="승인 프로세스" subtitle="요청 → 검토 → 승인 → 등록" icon={ClipboardList}>
            <ol className="flex flex-col gap-3">
              {[
                { step: "1", label: "요청 등록", desc: "사용자 신규 자산 요청", accent: "primary" as Accent, done: true },
                { step: "2", label: "관리자 검토", desc: "Source URL·중복 여부 확인", accent: "warning" as Accent, done: true },
                { step: "3", label: "승인 / 반려", desc: "관리자 승인 결정", accent: "success" as Accent, done: false },
                { step: "4", label: "마스터 등록", desc: "공식 관리 대상 편입", accent: "eos" as Accent, done: false },
              ].map((s) => (
                <li key={s.step} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
                  <StatusBadge accent={s.accent}>{s.step}</StatusBadge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{s.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  {s.done ? (
                    <CircleCheck className="h-4 w-4 text-success" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                  )}
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>
      </div>

      {/* Request list */}
      <SectionCard title="요청 내역" subtitle="최근 신규 자산 등록 요청" icon={ClipboardList}>
        <TableShell>
          <thead>
            <tr>
              <Th>요청번호</Th>
              <Th>제품명</Th>
              <Th>벤더</Th>
              <Th>요청자</Th>
              <Th>요청일</Th>
              <Th>승인 상태</Th>
              <Th>관리자 의견</Th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.no} className="transition-colors hover:bg-accent/40">
                <Td className="font-mono text-xs text-muted-foreground">{r.no}</Td>
                <Td className="font-semibold">{r.name}</Td>
                <Td className="text-muted-foreground">{r.vendor}</Td>
                <Td>{r.requester}</Td>
                <Td className="text-xs text-muted-foreground">{r.date}</Td>
                <Td>
                  <StatusBadge accent={approvalAccent[r.approval]}>{r.approval}</StatusBadge>
                </Td>
                <Td className="text-sm text-muted-foreground">{r.comment}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </SectionCard>
    </div>
  )
}
