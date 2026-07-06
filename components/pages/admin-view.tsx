"use client"

import { useState } from "react"
import {
  Settings,
  Database,
  Link2,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  ScrollText,
  Play,
  Zap,
  Lock,
} from "lucide-react"
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  type Accent,
} from "@/components/portal/ui"
import { useRole } from "@/components/portal/role-context"
import { cn } from "@/lib/utils"

/* ---- Section 1: SW master ---- */
const masters = [
  { id: "M-001", name: "Apache Tomcat", vendor: "Apache", cat: "Middleware", std: "10.1.24", mode: "AUTO", active: true, updated: "오늘" },
  { id: "M-002", name: "Oracle Database", vendor: "Oracle", cat: "DB", std: "19c", mode: "SEMI_AUTO", active: true, updated: "어제" },
  { id: "M-003", name: "OpenSSL", vendor: "OpenSSL Project", cat: "Security", std: "3.2.x", mode: "AUTO", active: true, updated: "오늘" },
  { id: "M-004", name: "JEUS", vendor: "TmaxSoft", cat: "Middleware", std: "8.0", mode: "MANUAL", active: false, updated: "2026-06-20" },
]

/* ---- Section 2: Source URL ---- */
const sources = [
  { name: "OpenSSL", type: "Vendor Security Advisory", url: "openssl.org/news/vulnerabilities", cycle: "1시간", last: "오늘 09:30", status: "정상" },
  { name: "Apache Tomcat", type: "KISA", url: "knvd.krcert.or.kr", cycle: "6시간", last: "오늘 10:15", status: "정상" },
  { name: "Oracle Database", type: "Lifecycle Page", url: "oracle.com/security-alerts", cycle: "일 1회", last: "어제 17:40", status: "지연" },
  { name: "Nginx", type: "Release Notes", url: "nginx.org/en/CHANGES", cycle: "6시간", last: "어제 14:05", status: "실패" },
]

const sourceStatusAccent: Record<string, Accent> = {
  정상: "success", 지연: "warning", 실패: "destructive",
}

/* ---- Section 5: users ---- */
const users = [
  { name: "김관리", email: "admin@corp.com", dept: "정보보안팀", role: "관리자", assets: 0, active: true },
  { name: "정재율", email: "jy.jung@corp.com", dept: "인프라팀", role: "승인자", assets: 24, active: true },
  { name: "홍길동", email: "gd.hong@corp.com", dept: "WAS운영팀", role: "담당자", assets: 18, active: true },
  { name: "이영희", email: "yh.lee@corp.com", dept: "WEB운영팀", role: "조회 사용자", assets: 12, active: false },
]

const roleAccent: Record<string, Accent> = {
  관리자: "destructive", 승인자: "eos", 담당자: "primary", "조회 사용자": "muted",
}

/* ---- Section 6: logs ---- */
const logs = [
  { time: "10:32:04", type: "수집", target: "OpenSSL Advisory", result: "성공", who: "스케줄러" },
  { time: "10:15:22", type: "승인", target: "REQ-2026-002", result: "성공", who: "정재율" },
  { time: "09:58:11", type: "수집", target: "Nginx Release Notes", result: "실패", who: "스케줄러" },
  { time: "09:30:47", type: "매핑", target: "CVE-2026-0001", result: "성공", who: "김관리" },
]

const resultAccent: Record<string, Accent> = { 성공: "success", 실패: "destructive" }

function Toggle({
  label,
  desc,
  defaultOn = false,
}: {
  label: string
  desc: string
  defaultOn?: boolean
}) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform",
            on ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  )
}

export function AdminView() {
  const [collecting, setCollecting] = useState(false)
  const { isAdmin } = useRole()

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={Settings}
          title="관리자 페이지"
          description="관리자는 SW 마스터 데이터, Source URL, 자동수집 정책, 승인 프로세스, 사용자 권한을 통합 관리합니다."
        />
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card px-6 py-16 text-center glow-card">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-eos/15 text-eos">
            <Lock className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground">접근 권한이 없습니다</h3>
          <p className="max-w-sm text-pretty text-sm text-muted-foreground">
            이 페이지는 <span className="font-semibold text-primary">관리자 모드</span>에서만
            이용할 수 있습니다. 상단의 모드 전환 스위치를 사용해 관리자 모드로 변경하세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Settings}
        title="관리자 페이지"
        description="관리자는 SW 마스터 데이터, Source URL, 자동수집 정책, 승인 프로세스, 사용자 권한을 통합 관리합니다."
      />

      {/* Section 1: SW master */}
      <SectionCard title="SW 마스터 관리" subtitle="표준 소프트웨어 마스터 데이터" icon={Database}>
        <TableShell>
          <thead>
            <tr>
              <Th>마스터 ID</Th><Th>제품명</Th><Th>벤더</Th><Th>분류</Th>
              <Th>표준 버전</Th><Th>수집 모드</Th><Th>사용 여부</Th><Th>최근 갱신일</Th>
            </tr>
          </thead>
          <tbody>
            {masters.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-accent/40">
                <Td className="font-mono text-xs text-muted-foreground">{m.id}</Td>
                <Td className="font-semibold">{m.name}</Td>
                <Td className="text-muted-foreground">{m.vendor}</Td>
                <Td><StatusBadge accent="primary">{m.cat}</StatusBadge></Td>
                <Td className="font-mono text-xs">{m.std}</Td>
                <Td><StatusBadge accent="eos">{m.mode}</StatusBadge></Td>
                <Td>
                  <StatusBadge accent={m.active ? "success" : "muted"}>
                    {m.active ? "사용" : "미사용"}
                  </StatusBadge>
                </Td>
                <Td className="text-xs text-muted-foreground">{m.updated}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </SectionCard>

      {/* Section 2: Source URL */}
      <SectionCard title="공식 Source URL 관리" subtitle="자동수집 대상 공식 출처" icon={Link2}>
        <TableShell>
          <thead>
            <tr>
              <Th>제품명</Th><Th>Source 유형</Th><Th>공식 URL</Th>
              <Th>수집 주기</Th><Th>마지막 수집</Th><Th>상태</Th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.name} className="transition-colors hover:bg-accent/40">
                <Td className="font-semibold">{s.name}</Td>
                <Td className="text-muted-foreground">{s.type}</Td>
                <Td className="font-mono text-xs text-primary">{s.url}</Td>
                <Td className="text-xs">{s.cycle}</Td>
                <Td className="text-xs text-muted-foreground">{s.last}</Td>
                <Td>
                  <StatusBadge accent={sourceStatusAccent[s.status]} pulse={s.status === "실패"}>
                    {s.status}
                  </StatusBadge>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Section 3: Auto collect */}
        <SectionCard
          title="자동수집 설정"
          subtitle="스케줄러 및 수동 수집"
          icon={RefreshCw}
          action={
            <button
              type="button"
              onClick={() => {
                setCollecting(true)
                setTimeout(() => setCollecting(false), 3200)
              }}
              className="glow-card inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition-transform hover:-translate-y-0.5"
            >
              <Play className="h-3.5 w-3.5" />
              즉시 수집
            </button>
          }
        >
          <div className="flex flex-col gap-3">
            <Toggle label="자동 수집 스케줄러" desc="공식 Source 주기적 자동 수집" defaultOn />
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">수집 주기</p>
                <p className="text-xs text-muted-foreground">기본 수집 인터벌</p>
              </div>
              <select className="rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none">
                <option>1시간</option>
                <option>6시간</option>
                <option>일 1회</option>
              </select>
            </div>

            {/* Collection log with shimmer while collecting */}
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" />
                수집 기동 내역
              </p>
              <ul className="flex flex-col gap-1.5 text-xs">
                {collecting ? (
                  <>
                    <li className="shimmer h-7 rounded-md bg-card" />
                    <li className="shimmer h-7 rounded-md bg-card" />
                    <li className="shimmer h-7 rounded-md bg-card" />
                  </>
                ) : (
                  <>
                    <li className="flex items-center justify-between rounded-md bg-card px-2 py-1.5">
                      <span className="text-muted-foreground">OpenSSL Advisory</span>
                      <StatusBadge accent="success">성공</StatusBadge>
                    </li>
                    <li className="flex items-center justify-between rounded-md bg-card px-2 py-1.5">
                      <span className="text-muted-foreground">Apache Tomcat (KISA)</span>
                      <StatusBadge accent="success">성공</StatusBadge>
                    </li>
                    <li className="flex items-center justify-between rounded-md bg-card px-2 py-1.5">
                      <span className="text-muted-foreground">Nginx Release Notes</span>
                      <StatusBadge accent="destructive" pulse>실패</StatusBadge>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* Section 4: Approval policy */}
        <SectionCard title="승인 정책 관리" subtitle="자동 알림 및 승인 규칙" icon={ShieldCheck}>
          <div className="flex flex-col gap-3">
            <Toggle label="Critical 자동 긴급 알림" desc="Critical 취약점 발견 시 즉시 알림" defaultOn />
            <Toggle label="High 이상 관리자 승인 필수" desc="High 등급 이상 패치는 관리자 승인" defaultOn />
            <Toggle label="EOS 180일 전 알림" desc="지원 종료 180일 전 담당자 알림" defaultOn />
            <Toggle label="패치 공지 수집 후 승인 대기 등록" desc="수집된 공지를 자동으로 승인 대기 큐에 등록" />
          </div>
        </SectionCard>
      </div>

      {/* Section 5: Users */}
      <SectionCard title="사용자 권한 관리" subtitle="관리자 · 승인자 · 담당자 · 조회 사용자" icon={UsersRound}>
        <TableShell>
          <thead>
            <tr>
              <Th>사용자명</Th><Th>이메일</Th><Th>부서</Th>
              <Th>권한</Th><Th>담당 자산 수</Th><Th>상태</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="transition-colors hover:bg-accent/40">
                <Td className="font-semibold">{u.name}</Td>
                <Td className="font-mono text-xs text-muted-foreground">{u.email}</Td>
                <Td className="text-muted-foreground">{u.dept}</Td>
                <Td><StatusBadge accent={roleAccent[u.role]}>{u.role}</StatusBadge></Td>
                <Td className="font-mono">{u.assets}</Td>
                <Td>
                  <StatusBadge accent={u.active ? "success" : "muted"}>
                    {u.active ? "활성" : "비활성"}
                  </StatusBadge>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </SectionCard>

      {/* Section 6: Logs */}
      <SectionCard title="시스템 로그" subtitle="수집·승인·매핑 작업 이력" icon={ScrollText}>
        <TableShell>
          <thead>
            <tr>
              <Th>시간</Th><Th>작업 유형</Th><Th>대상</Th><Th>결과</Th><Th>수행자</Th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} className="transition-colors hover:bg-accent/40">
                <Td className="font-mono text-xs text-muted-foreground">{l.time}</Td>
                <Td><StatusBadge accent="primary">{l.type}</StatusBadge></Td>
                <Td className="font-mono text-xs">{l.target}</Td>
                <Td>
                  <StatusBadge accent={resultAccent[l.result]} pulse={l.result === "실패"}>
                    {l.result}
                  </StatusBadge>
                </Td>
                <Td className="text-muted-foreground">{l.who}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </SectionCard>
    </div>
  )
}
