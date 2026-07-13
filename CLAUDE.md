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

Role state lives in `RoleProvider` (`components/portal/role-context.tsx`). Currently defaults to `"admin"` and is toggled via `RoleToggle` in the header — no real auth.

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

- **Migrated** (query real tables, no mock data standing in for query results): `dashboard-view.tsx` (보안 대시보드의 취약점 위젯은 `approval === "승인완료"`만 조회 전용으로 노출 — 매핑/승인/반려/알림 등 조작 버튼 없음), `eos-view.tsx` (`assets` table), `assets-view.tsx`, `patch-view.tsx`, `kisa-view.tsx`, `notifications-view.tsx`, `notice-boards.tsx`, `sw-master-view.tsx` (`sw_masters` table, editable draft grid via `sw-master/use-master-draft.ts`), `servers-view.tsx` (`servers` table, "admin-servers" nav entry, Source URL 관리 스타일의 즉시 반영형 CRUD), `admin-view.tsx` (`sources`/`app_users` 테이블 기반 즉시 반영형 CRUD로 전환 완료 — "즉시 수집"은 `app/api/collect-source/route.ts`로 스크래핑 후 `vulnerabilities`에 삽입하고 매칭되는 `sources` 행의 상태·마지막 수집 시각도 갱신; 시스템 로그 섹션은 대응 테이블 없이 UI에서 제거됨), `request-view.tsx` (`asset_requests` + `notifications`; product picker sources from `sw_masters`, 설치 서버 드롭다운은 `servers`에서), `approval-view.tsx` (`asset_requests` read/update, inserts into `assets` on approval, `notifications`), `asset-dashboard-view.tsx` (`assets` table; its `<AssetBoards />` child, `components/dashboard/asset-boards.tsx`, self-fetches `notices`/`asset_requests`/`vulnerabilities` for its three panels), and the presentational dashboard widgets they feed (`charts.tsx`, `kpi-cards.tsx`, `critical-alerts.tsx`, `asset-charts.tsx`).
- **Not migrated**: none currently known — re-verify with a fresh scan before trusting this line, since this table has already gone stale more than once.

The three React contexts provided at the root:
- `RoleProvider` — current role (admin/owner), still mock — no real auth
- `ToastProvider` — imperative toast API (`useToast().toast({...})`), in-memory only
- `NotificationsProvider` — Supabase-backed: reads/writes the `notifications` table (read/unread state persists)

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

Tables actually in use: `assets`, `servers`, `vulnerabilities`, `notifications`, `notices`, `sw_masters`, `asset_requests`, `sources`, `app_users` (read via `select`, written via `update`/`insert` where noted above). See "Data & state" above for the per-file migration status; don't assume a page is mock just because a sibling page is, or fully migrated just because it has a `supabase.from(...)` call somewhere in it.

### Key patterns

- `glow-card`, `animate-rise`, `animate-view` — utility CSS classes defined in `app/globals.css`
- `useCountUp` hook animates KPI numbers on mount (easeOutExpo)
- `AssetSlideover` — right-panel detail drawer used in AssetsView
