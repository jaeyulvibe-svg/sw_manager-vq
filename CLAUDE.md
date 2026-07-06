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

All data is **hardcoded mock arrays** inside each component — there is no backend or database connection. Supabase integration is planned but not yet implemented.

The three React contexts provided at the root:
- `RoleProvider` — current role (admin/owner)
- `ToastProvider` — imperative toast API (`useToast().toast({...})`)
- `NotificationsProvider` — notification list with read/unread state

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

All current data is **hardcoded mock arrays** inside each page component. When wiring up Supabase, replace those arrays with `supabase.from("table").select()` calls in Server Components or via client-side hooks.

### Key patterns

- `glow-card`, `animate-rise`, `animate-view` — utility CSS classes defined in `app/globals.css`
- `useCountUp` hook animates KPI numbers on mount (easeOutExpo)
- `AssetSlideover` — right-panel detail drawer used in AssetsView
