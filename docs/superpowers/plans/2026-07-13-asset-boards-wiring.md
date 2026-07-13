# asset-boards.tsx 실데이터 연결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `components/dashboard/asset-boards.tsx`의 세 하드코딩 패널(공지사항/자산 변경 요청/EOS·패치·보안공지 피드)을 각각 `notices`/`asset_requests`/`vulnerabilities` Supabase 테이블에 연결한다.

**Architecture:** 각 패널 컴포넌트(`NoticePanel`, `ChangeRequestPanel`, `FeedPanel`)가 독립적으로 `useEffect` + `createClient()`로 자체 테이블을 조회하는 self-fetch 패턴 (`components/dashboard/notice-boards.tsx`의 `NoticeBoard`와 동일 패턴). `AssetBoards`는 계속 props 없이 세 패널을 렌더링만 한다. `asset-dashboard-view.tsx`는 무변경.

**Tech Stack:** Next.js App Router (client components), `@supabase/ssr` client (`lib/supabase/client.ts`), `lib/supabase/types.ts`의 `Tables<>` 타입 헬퍼, 기존 디자인 시스템(`components/portal/ui.tsx`의 `SectionCard`/`StatusBadge`).

## Global Constraints

- 이 프로젝트는 테스트 스위트가 없다 (`CLAUDE.md`) — 검증은 `npx tsc --noEmit`(타입) + `pnpm lint`(ESLint) + 개발 서버 수동 확인으로 대체한다.
- `next.config.mjs`의 `typescript.ignoreBuildErrors: true`로 인해 `pnpm build`는 타입 에러로 실패하지 않으므로, 타입 정합성은 `tsc --noEmit`으로 별도 확인해야 한다.
- 클릭 인터랙션(토스트 상세 등)을 추가하지 않는다 — 읽기 전용 요약 위젯 유지.
- 세 패널 모두 최신 4건만 표시 (`.order(...).limit(4)`).
- `asset-dashboard-view.tsx`, `admin-view.tsx`는 이번 작업 범위 밖 — 수정하지 않는다.
- 설계 근거 문서: `docs/superpowers/specs/2026-07-13-asset-boards-wiring-design.md`

---

## Before You Start

Read these existing files for the patterns you'll be copying:
- `components/dashboard/notice-boards.tsx` — self-fetch `useEffect` 패턴, `categoryAccent` 맵, `formatCollected` 함수, empty-state 문구 스타일
- `components/pages/approval-view.tsx` — `asset_requests` 조회 패턴, `approvalRisk` 맵
- `components/pages/patch-view.tsx` (44-52줄 근처) — `noticeTypeAccent` 맵
- `lib/supabase/types.ts` (99-256줄) — `vulnerabilities`/`asset_requests`/`notices` Row 타입

Current file under modification: `components/dashboard/asset-boards.tsx` (234 lines, full content already read in this session).

---

### Task 1: NoticePanel을 `notices` 테이블에 연결

**Files:**
- Modify: `components/dashboard/asset-boards.tsx` (상단 import 블록 + `NoticePanel` 섹션, 1-72줄)

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`, `Tables<"notices">` from `@/lib/supabase/types`
- Produces: 변경 없음 (내부 컴포넌트, export 안 됨) — Task 2/3에는 영향 없음. 단, 이 Task에서 파일 상단 import를 `"use client"` 아래에 `import { useEffect, useState } from "react"`와 `import { createClient } from "@/lib/supabase/client"`, `import type { Tables } from "@/lib/supabase/types"`를 추가하며, 이 import들은 Task 2/3도 재사용한다 (중복 추가하지 않도록 Task 2/3에서는 "이미 있으면 건너뛴다"고 명시).

- [ ] **Step 1: import 블록 갱신**

`components/dashboard/asset-boards.tsx` 최상단을 다음으로 교체:

```tsx
"use client"

import { useEffect, useState } from "react"
import {
  Megaphone,
  FileEdit,
  Rss,
  CalendarX,
  Package,
  ShieldAlert,
} from "lucide-react"
import { SectionCard, StatusBadge, type Accent, type RiskLevel } from "@/components/portal/ui"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"
```

(`ClipboardCheck` 아이콘은 이후 Task에서 더 이상 쓰이지 않으므로 이 시점에 목록에서 제거한다. `Package`/`CalendarX`/`ShieldAlert`는 Task 2/3에서 계속 쓰이므로 유지.)

- [ ] **Step 2: NoticePanel을 실데이터로 교체**

기존 15-72줄(`/* ---------------- 공지사항 ---------------- */`부터 `NoticePanel` 함수 끝까지, `const notices: Notice[] = [...]` 목업 배열과 `type Notice` 포함)을 아래로 통째로 교체:

```tsx
/* ---------------- 공지사항 ---------------- */

type Notice = Tables<"notices">

const noticeCategoryAccent: Record<string, Accent> = {
  시스템: "primary",
  운영: "success",
  승인: "eos",
  보고서: "muted",
}

function NoticePanel() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("notices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data) setNotices(data)
        setLoading(false)
      })
  }, [])

  return (
    <SectionCard title="공지사항" subtitle="포털 운영 공지" icon={Megaphone}>
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : notices.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          등록된 공지사항이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/50">
          {notices.map((n) => (
            <li
              key={n.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <StatusBadge accent={noticeCategoryAccent[n.category] ?? "muted"}>
                {n.category}
              </StatusBadge>
              <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                {n.title}
              </p>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleDateString("ko-KR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
```

- [ ] **Step 3: 타입 체크로 검증**

Run: `npx tsc --noEmit`
Expected: `asset-boards.tsx` 관련 에러 없음 (다른 파일의 기존 에러가 있었다면 그 개수는 그대로여야 함 — 이 파일에서 새로 발생한 에러만 없으면 됨).

- [ ] **Step 4: 개발 서버로 육안 확인**

Run: `pnpm dev` (백그라운드로 띄운 뒤) → 브라우저에서 `http://localhost:3000` 접속 → 자산 대시보드(사이드바 "자산 대시보드" 또는 해당 뷰) 진입 → 최하단 "공지사항" 패널에 시드 데이터 4건(AI SW Asset Master 정기 점검 안내 등)이 배지+제목+날짜로 표시되는지 확인.
Expected: 로딩 스피너/스켈레톤이 잠깐 보인 뒤 실제 공지 4건이 표시됨. 콘솔에 Supabase 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/asset-boards.tsx
git commit -m "feat: wire asset-boards NoticePanel to notices table"
```

---

### Task 2: ChangeRequestPanel을 `asset_requests` 테이블에 연결

**Files:**
- Modify: `components/dashboard/asset-boards.tsx` (`ChangeRequestPanel` 섹션 — Task 1 완료 후 파일 내에서 `/* ---------------- SW 자산 변경 요청 ---------------- */`부터 `ChangeRequestPanel` 함수 끝까지)

**Interfaces:**
- Consumes: Task 1에서 이미 추가된 `useEffect`/`useState`/`createClient`/`Tables` import (재사용, 중복 추가 금지)
- Produces: 변경 없음 (내부 컴포넌트)

- [ ] **Step 1: ChangeRequestPanel을 실데이터로 교체**

`type ChangeReq`, `changeReqRisk`, `const changeReqs: ChangeReq[] = [...]` 목업과 `ChangeRequestPanel` 함수 전체를 아래로 교체:

```tsx
/* ---------------- SW 자산 변경 요청 ---------------- */

type AssetRequest = Tables<"asset_requests">

const requestApprovalRisk: Record<AssetRequest["approval"], RiskLevel> = {
  반려: 5,
  승인대기: 3,
  검토중: 2,
  승인완료: 1,
}

function ChangeRequestPanel() {
  const [requests, setRequests] = useState<AssetRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("asset_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data) setRequests(data)
        setLoading(false)
      })
  }, [])

  return (
    <SectionCard
      title="SW 자산 변경 요청"
      subtitle="등록·변경·폐기 요청 현황"
      icon={FileEdit}
    >
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          등록된 자산 변경 요청이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/50">
          {requests.map((r) => {
            const risk = requestApprovalRisk[r.approval]
            return (
              <li key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    risk === 5 && "border-risk-5/40 bg-risk-5/15 text-risk-5",
                    risk === 3 && "border-risk-3/40 bg-risk-3/15 text-risk-3",
                    risk === 2 && "border-risk-2/40 bg-risk-2/12 text-risk-2",
                    risk === 1 && "border-risk-1/40 bg-risk-1/12 text-risk-1",
                  )}
                >
                  <Package className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.requester} · {r.requester_dept}
                  </p>
                </div>
                <StatusBadge risk={risk}>{r.approval}</StatusBadge>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
```

- [ ] **Step 2: 타입 체크로 검증**

Run: `npx tsc --noEmit`
Expected: `asset-boards.tsx` 관련 에러 없음.

- [ ] **Step 3: 개발 서버로 육안 확인**

`pnpm dev`가 이미 떠 있다면 (Task 1에서 시작) hot-reload로 자동 반영됨. 자산 대시보드의 "SW 자산 변경 요청" 패널에 시드 데이터(REQ-2026-004, REQ-2026-003, REQ-2026-002, REQ-2026-001 — created_at 내림차순) 4건이 표시되는지 확인.
Expected: 각 행에 제품명, 요청자·부서, 승인 상태 배지가 표시되고 반려 상태 색상도 정상 렌더링됨(현재 시드에는 반려 데이터가 없으므로 승인대기/검토중/승인완료 3색만 눈으로 확인 가능 — 반려 색상 매핑 자체는 코드 리뷰로 확인).

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/asset-boards.tsx
git commit -m "feat: wire asset-boards ChangeRequestPanel to asset_requests table"
```

---

### Task 3: FeedPanel을 `vulnerabilities` 테이블에 연결

**Files:**
- Modify: `components/dashboard/asset-boards.tsx` (`FeedPanel` 섹션 — `/* ---------------- EOS/패치/보안공지 피드 ---------------- */`부터 `FeedPanel` 함수 끝까지)

**Interfaces:**
- Consumes: Task 1에서 추가된 import 재사용. `Package`, `CalendarX`, `ShieldAlert` 아이콘은 Task 1의 import 목록에 이미 포함되어 있음 (재사용, 재추가 금지).
- Produces: 변경 없음 (내부 컴포넌트)

- [ ] **Step 1: FeedPanel을 실데이터로 교체**

`type Feed`, `const feeds: Feed[] = [...]` 목업과 `FeedPanel` 함수 전체를 아래로 교체:

```tsx
/* ---------------- EOS/패치/보안공지 피드 ---------------- */

type Vulnerability = Tables<"vulnerabilities">
type NoticeType = Vulnerability["notice_type"]

const feedNoticeTypeAccent: Record<NoticeType, Accent> = {
  CVE: "destructive",
  Patch: "warning",
  EOS: "eos",
}

const feedNoticeTypeIcon: Record<NoticeType, typeof CalendarX> = {
  CVE: ShieldAlert,
  Patch: Package,
  EOS: CalendarX,
}

function formatCollected(iso: string) {
  const d = new Date(iso)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
  if (diffDays === 0) return `오늘 ${time}`
  if (diffDays === 1) return `어제 ${time}`
  return `${d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} ${time}`
}

function FeedPanel() {
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("vulnerabilities")
      .select("*")
      .order("collected_at", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (data) setVulns(data)
        setLoading(false)
      })
  }, [])

  return (
    <SectionCard
      title="EOS·패치·보안공지 피드"
      subtitle="자산 연계 실시간 수집 이벤트"
      icon={Rss}
    >
      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : vulns.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          수집된 공지가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col">
          {vulns.map((v, i) => {
            const accent = feedNoticeTypeAccent[v.notice_type]
            const Icon = feedNoticeTypeIcon[v.notice_type]
            return (
              <li key={v.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i !== vulns.length - 1 ? (
                  <span className="absolute left-[15px] top-8 h-full w-px bg-border/60" />
                ) : null}
                <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      accent === "eos" && "text-eos",
                      accent === "warning" && "text-warning",
                      accent === "destructive" && "text-destructive",
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {v.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.product} · {formatCollected(v.collected_at)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
```

- [ ] **Step 2: 타입 체크로 검증**

Run: `npx tsc --noEmit`
Expected: `asset-boards.tsx` 관련 에러 없음.

- [ ] **Step 3: 개발 서버로 육안 확인**

자산 대시보드의 "EOS·패치·보안공지 피드" 패널에 시드 데이터(OpenSSL CVE-2026-0001, Apache Tomcat CVE-2026-0002, Oracle DB Patch Update, Nginx CVE-2026-0003 — collected_at 내림차순) 4건이 타임라인 형태로 표시되는지 확인.
Expected: CVE 항목은 destructive(빨강) ShieldAlert 아이콘, Patch/EOS 유형이 섞여 있다면 각각 warning/eos 색상으로 구분 표시. 콘솔 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/asset-boards.tsx
git commit -m "feat: wire asset-boards FeedPanel to vulnerabilities table"
```

---

### Task 4: 전체 검증 및 마무리

**Files:**
- Read-only verification, no new file changes expected (unless lint surfaces an issue in Task 1-3's code, in which case fix in `components/dashboard/asset-boards.tsx`).

**Interfaces:**
- Consumes: 완료된 Task 1-3의 `asset-boards.tsx`
- Produces: 없음 (최종 검증 단계)

- [ ] **Step 1: 전체 린트 실행**

Run: `pnpm lint`
Expected: `components/dashboard/asset-boards.tsx`에서 에러 없음 (unused import 등). 에러가 나오면 해당 줄을 고치고 재실행.

- [ ] **Step 2: 전체 타입 체크**

Run: `npx tsc --noEmit`
Expected: 이전 Task들에서 이미 통과했던 상태 유지 — 새 에러 없음.

- [ ] **Step 3: `AssetBoards` export 및 `asset-dashboard-view.tsx` 연동 재확인**

`components/dashboard/asset-boards.tsx` 맨 아래 `export function AssetBoards()` 블록(225-233줄)이 여전히 다음과 동일한지 확인 (변경 없어야 함):

```tsx
export function AssetBoards() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <NoticePanel />
      <ChangeRequestPanel />
      <FeedPanel />
    </div>
  )
}
```

- [ ] **Step 4: 개발 서버 최종 확인**

`pnpm dev` 상태에서 자산 대시보드 페이지를 새로고침 → 세 패널 모두 실데이터로 정상 렌더링되고, 브라우저 개발자 콘솔에 에러/경고(Supabase 쿼리 실패, React key 경고 등)가 없는지 최종 확인. 확인 후 `pnpm dev` 프로세스 종료.

- [ ] **Step 5: 최종 커밋 (필요 시)**

Task 1-3에서 이미 각각 커밋했으므로, Task 4에서 lint/typecheck로 인한 추가 수정이 없었다면 커밋할 것이 없다. 수정이 있었다면:

```bash
git add components/dashboard/asset-boards.tsx
git commit -m "fix: address lint/typecheck findings in asset-boards wiring"
```

---

## Self-Review Notes

- **Spec coverage:** 설계 문서의 3개 패널(공지/변경요청/피드) 모두 Task 1-3에서 다룸. "클릭 인터랙션 없음" 제약은 코드에 onClick 핸들러를 추가하지 않는 것으로 반영됨. "최신 4건" 제약은 각 쿼리의 `.limit(4)`로 반영됨. 로딩 스켈레톤은 각 패널에 개별 구현. `asset-dashboard-view.tsx`/`admin-view.tsx` 비수정은 Global Constraints에 명시.
- **Placeholder scan:** 전 Task에 완전한 코드 블록 포함, "TODO"/"나중에" 등 없음.
- **Type consistency:** `Notice`/`AssetRequest`/`Vulnerability` 타입 별칭과 각 risk/accent 맵 이름(`noticeCategoryAccent`, `requestApprovalRisk`, `feedNoticeTypeAccent`/`feedNoticeTypeIcon`)이 Task 1-3 전체에서 일관되게 사용됨 — 접두어를 패널별로 분리해 이름 충돌 없음 확인.
