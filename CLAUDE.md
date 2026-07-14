# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start development server (http://localhost:3000)
pnpm build      # Production build
pnpm lint       # ESLint check
```

No test suite is configured. `next.config.mjs` has `typescript.ignoreBuildErrors: true` — type errors won't fail the build.

## Architecture

This is a **single-page app** — Next.js routing is not used. All navigation is client-side state managed in `app/page.tsx`. The active view is a `ViewKey` string; `renderView()` switches on it to render the correct page component.

### Navigation & RBAC

`components/portal/nav.ts` is the single source of truth for:
- `ViewKey` union type (all valid view names)
- `NAV_ITEMS` array (sidebar entries with `adminOnly`/`userOnly` flags)
- `visibleNavItems(isAdmin)` — filters items by role
- `isViewAllowed(key, isAdmin)` — used in `page.tsx` to fallback unauthorized views to dashboard

Role state lives in `RoleProvider` (`components/portal/role-context.tsx`) — it now sources `currentUser`/`users` live from the `app_users` table (`active=true`, sorted 관리자→승인자→담당자→조회 사용자 then by name). The header's `UserSwitcher` (`components/portal/user-switcher.tsx`) lets the operator pick any of these people to simulate being logged in as them; the choice persists via `localStorage["sw-manager-current-user-id"]`. `isAdmin` derives from `currentUser?.role === "관리자"` (승인자 does NOT get admin nav). Still no real auth — separate from the password-based `AuthGate` in `app/page.tsx`.

### Component layers

| Directory | Purpose |
|---|---|
| `components/portal/` | Layout shell: Sidebar, PortalHeader, contexts (Role, Toast, Notifications), AmbientBackground, CommandPalette |
| `components/portal/ui.tsx` | Internal design system: PageHeader, StatCard, SectionCard, TableShell, StatusBadge, ProgressBar, MiniButton |
| `components/pages/` | Full-page view components, one per `ViewKey` |
| `components/dashboard/` | Widgets composed inside DashboardView (charts, KPI cards, boards) |
| `components/ui/` | Only `button.tsx` — wraps `@base-ui/react` Button with CVA variants |

### Data & state

Supabase is **live and wired up**, but the migration off mock arrays is partial — check each file before assuming either way:

- **Migrated** (query real tables, no mock data standing in for query results): `dashboard-view.tsx` (보안 대시보드의 취약점 위젯은 `approval === "승인완료"`만 조회 전용으로 노출 — 매핑/승인/반려/알림 등 조작 버튼 없음), `eos-view.tsx` (`assets` table), `assets-view.tsx` (`assets`/`servers` tables; 행별 `수정` 버튼은 담당자·설치 서버·승인 상태 3개 필드만 편집하는 즉시반영형 인라인 패널, `수집` 버튼은 추적 대상 8개 제품에 한해 `/api/collect-source`를 그 제품 하나로 좁혀 실제 호출한 뒤 `checked_at` 갱신 — 비대상 제품은 안내만 하고 아무것도 호출하지 않음), `patch-view.tsx`, `kisa-view.tsx`/`vendor-view.tsx`/`eos-notice-view.tsx` (모두 `notice-board/notice-review-board.tsx` 공유 — 승인 시 `admin_policies.critical_urgent_alert` 값에 따라 Critical 등급 알림 생성 여부가 갈림), `notifications-view.tsx`, `notice-boards.tsx`, `notice-board-view.tsx` (`notices` table, "notice-board" nav entry — 관리자는 추가·수정·체크박스 선택 삭제, 사용자는 조회 전용; 본문(`content`) 컬럼으로 행 확장형 상세보기 제공), `sw-master-view.tsx` (`sw_masters` table, servers-view.tsx와 동일한 검색/정렬/컬럼설정 + 추가·편집(체크박스 선택 삭제) 게시판 스타일 — 삭제는 소프트 삭제(`deleted_at`/`deleted_by`, `active=false`)로 참조 무결성 유지; 공유 상수는 `sw-master/master-shared.ts`, 조회 전용 배지는 `sw-master/cells.tsx`), `servers-view.tsx` (`servers` table, "admin-servers" nav entry, 추가·편집(체크박스 선택 삭제) 게시판 스타일 즉시 반영형 CRUD), `admin-view.tsx` (`sources`/`app_users` 테이블 기반 즉시 반영형 CRUD로 전환 완료 — "즉시 수집"은 `app/api/collect-source/route.ts`로 스크래핑 후 `vulnerabilities`에 삽입하고 매칭되는 `sources` 행의 상태·마지막 수집 시각도 갱신; 시스템 로그 섹션은 대응 테이블 없이 UI에서 제거됨; `수집 관리`/`승인 정책` 탭은 `admin_policies` 단일 행(id='default')에 즉시반영형으로 바인딩됨 — `자동 수집 스케줄러`/`수집 주기`는 값만 저장(서버 cron 없음), `승인 정책` 4개 토글 중 `High 이상 관리자 승인 필수`/`패치 공지 수집 후 승인 대기 등록`은 `/api/collect-source`의 자동승인 분기(`shouldAutoApprove`)에 실제로 반영되고, `Critical 자동 긴급 알림`은 `lib/notice-approval.ts`의 알림 생성 여부를, `EOS 180일 전 알림`은 관리자 페이지 진입 시 지연 실행되는 중복방지 알림 체크를 게이팅함), `request-view.tsx` (`asset_requests` + `notifications`; product picker sources from `sw_masters`, 설치 서버 드롭다운은 `servers`에서), `approval-view.tsx` (`asset_requests` read/update, inserts into `assets` on approval, `notifications`), `patch-tasks-view.tsx` (`patch_tasks` table, "patch-tasks" nav entry — see below), `asset-dashboard-view.tsx` (`assets` table; its `<AssetBoards />` child, `components/dashboard/asset-boards.tsx`, self-fetches `notices`/`asset_requests`/`vulnerabilities` for its three panels), and the presentational dashboard widgets they feed (`charts.tsx`, `kpi-cards.tsx`, `critical-alerts.tsx`, `asset-charts.tsx`).
- **Not migrated**: none currently known — re-verify with a fresh scan before trusting this line, since this table has already gone stale more than once.

`lib/notice-approval.ts`: shared (non-`"use client"`) module holding the "flag matched assets as `확인필요` + upsert a `patch_tasks` row per matched asset + insert owner notifications" side effect, reused by both the manual approve button (`notice-board/notice-actions.ts`, browser client) and the server-side auto-collect route (`app/api/collect-source/route.ts`, service-role client) so the two approval paths can't drift apart.

`patch-tasks-view.tsx` ("내 조치 업무" nav entry, `patch_tasks` table): 공지 승인 시 매칭 자산마다 자동 생성되는 조치 티켓 목록 — 담당자가 조치예정/조치지연/조치완료/예외요청 + 기한/메모를 등록(조치예정은 기한 필수, 예외요청은 메모(사유) 필수 — 비어있으면 저장 차단). "본인 건만"은 헤더의 `UserSwitcher`로 고른 로그인 사용자(`role-context.tsx`의 `currentUser`)가 `role === "담당자"`일 때 `task.owner === currentUser.name`으로 자동 필터되며, 그 상태에서만 행별 "조치 등록" 버튼이 열림 — 관리자는 `예외요청` 상태인 행에 한해 승인(→`예외승인`으로 종결)/반려(→`조치예정`으로 복귀, 메모는 보존) 버튼을 사용할 수 있고 그 외 행은 이 화면에서 조회만 가능(담당자변경·완료확인은 여전히 미구현). `patch-view.tsx`(승인된 취약점 공지)의 매핑 자산 펼침 목록에도 자산별 조치 상태 배지와 "내 조치 업무 바로가기" 버튼이 추가됨.

`demo-data-view.tsx` ("DEMO 데이터 설정" nav entry, `demo_snapshots` table + `save_demo_snapshot()`/`reset_demo_data()` Postgres RPC functions) — 시연용 샘플 데이터를 저장된 기준 상태로 즉시 복원하는 관리자 전용 화면. `assets`/`servers`/`vulnerabilities`/`asset_requests`/`notifications`/`notices`/`licenses`/`sw_masters`/`sources`/`app_users`/`patch_tasks` 11개 테이블만 대상이며 `admin_policies`는 운영 설정으로 보고 제외; "초기화"는 `reset_demo_data()` RPC 한 번으로 11개 테이블을 원자적으로 delete+insert한 뒤 전체 페이지를 새로고침, "현재 데이터를 새 기준으로 저장"은 `save_demo_snapshot()` RPC로 기준 스냅샷을 갱신.

The three React contexts provided at the root:
- `RoleProvider` — current logged-in demo user (`app_users` row) + derived `isAdmin`, still simulated — no real auth
- `ToastProvider` — imperative toast API (`useToast().toast({...})`), in-memory only
- `NotificationsProvider` — Supabase-backed: reads/writes the `notifications` table (read/unread state persists). The list and its badge counts are scoped to `notifications.owner === currentUser?.name` unless `isAdmin` (approximate string match — `owner` is not a real recipient FK).

### Design system conventions

- Custom CSS variables for semantic colors: `--primary`, `--success`, `--warning`, `--destructive`, `--eos` (end-of-sale orange), `--muted-foreground`
- `Accent` type in `ui.tsx` maps to these variables; pass `accent` props to StatusBadge, StatCard, MiniButton, etc.
- `cn()` from `lib/utils.ts` — clsx + tailwind-merge
- Recharts is used for all charts; each chart file defines its own local `ChartCard` and `TooltipBox` wrappers

## Supabase

`lib/supabase/` contains the three standard SSR helpers:
- `client.ts` — `createClient()` for Client Components (`"use client"`)
- `server.ts` — `createClient()` for Server Components / Route Handlers (async, reads cookies)
- `middleware.ts` — `updateSession()` called in `middleware.ts` to keep the session alive

TypeScript types are in `lib/supabase/types.ts` and mirror the app's domain models. The `Tables<"assets">` helper gives you the `Row` type for any table.

Required env vars (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only — never expose to client)

Tables actually in use: `assets`, `servers`, `vulnerabilities`, `notifications`, `notices`, `sw_masters`, `asset_requests`, `sources`, `app_users`, `admin_policies`, `patch_tasks`, `demo_snapshots` (read via `select`, written via `update`/`insert` where noted above). See "Data & state" above for the per-file migration status; don't assume a page is mock just because a sibling page is, or fully migrated just because it has a `supabase.from(...)` call somewhere in it.

### Key patterns

- `glow-card`, `animate-rise`, `animate-view` — utility CSS classes defined in `app/globals.css`
- `useCountUp` hook animates KPI numbers on mount (easeOutExpo)
- `AssetSlideover` — right-panel detail drawer used in AssetsView
