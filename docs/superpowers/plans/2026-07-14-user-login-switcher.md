# 로그인 사용자 스위처 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded 관리자/사용자 role toggle with a "로그인 사용자로 전환" switcher that lists every active `app_users` row, lets the demo operator click any one of them to instantly become that person, and makes 사이드바/알림/내 조치 업무 reflect that specific person instead of a fixed binary role.

**Architecture:** `role-context.tsx`'s `RoleProvider`/`useRole()` keep their exported names (7 files elsewhere only destructure `isAdmin` and stay untouched) but the internals move from a `Role = "admin" | "owner"` `useState` to a live `app_users` query plus a selected-user id persisted in `localStorage`. A new `user-switcher.tsx` (replacing `role-toggle.tsx`) renders that user list in a popover using the exact outside-click/Escape pattern already in `notification-bell.tsx`. Two downstream consumers that hardcoded the old binary assumption — `sidebar.tsx`'s footer and `notifications-context.tsx`'s unfiltered query — are updated to key off the selected `app_users` row. `patch-tasks-view.tsx`'s manual "pick a 담당자 name to simulate being them" dropdown is deleted since the new switcher now does that job app-wide.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (`@supabase/supabase-js` via `@supabase/ssr`), TypeScript, Tailwind.

## Global Constraints

- No test suite is configured in this repo (`CLAUDE.md`) — every "verify" step below is `npx tsc --noEmit -p . 2>&1 | grep "<file>"` plus a manual check via `pnpm dev`, not an automated test run. Do not add a test framework as part of this plan.
- `next.config.mjs` has `typescript.ignoreBuildErrors: true`, so `npx tsc --noEmit` is the only thing that will actually catch type errors — always run it before committing a task.
- This is a **demo/simulation** switcher, not real auth — do not wire it to Supabase Auth, cookies, or `middleware.ts`. `app/page.tsx`'s `AuthGate` (password screen) is a separate, unrelated real gate and must not be touched.
- Follow existing conventions exactly: Korean UI strings, `StatusBadge`/`MiniButton` from `@/components/portal/ui`, `cn()` from `@/lib/utils`, `createClient()` from `@/lib/supabase/client` for all reads/writes, `Tables<"...">` from `@/lib/supabase/types` for row types.
- `app_users.role` has exactly 4 values: `"관리자" | "승인자" | "담당자" | "조회 사용자"`. Only `"관리자"` counts as `isAdmin` — `"승인자"` does NOT get admin-only nav/actions (per the design doc).
- Do not add: a real recipient/FK column on `notifications`, a search box on the user switcher, or any changes to `app_users` CRUD in `admin-view.tsx` — out of scope per `docs/superpowers/specs/2026-07-14-user-login-switcher-design.md`.
- localStorage key for the selected user id is exactly `sw-manager-current-user-id` — used in Task 1 and referenced nowhere else, but keep it consistent if you touch it later.

---

### Task 1: Replace the role toggle with a real user switcher

**Files:**
- Modify: `components/portal/role-context.tsx` (full rewrite)
- Create: `components/portal/user-switcher.tsx`
- Delete: `components/portal/role-toggle.tsx`
- Modify: `components/portal/portal-header.tsx:5`, `:65`
- Modify: `components/portal/sidebar.tsx:6`, `:9-12`, `:29-31`, `:263-270`

**Interfaces:**
- Produces: `useRole()` now returns `{ currentUser: Tables<"app_users"> | null, users: Tables<"app_users">[], loading: boolean, setCurrentUserId: (id: string) => void, isAdmin: boolean }`. The old `role`/`setRole`/`Role` exports are removed. Task 2 and Task 3 consume `currentUser` and `isAdmin` from this same hook.

- [ ] **Step 1: Rewrite `role-context.tsx`**

Replace the entire file content with:

```tsx
"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"

export type AppUserRow = Tables<"app_users">

const ROLE_RANK: Record<AppUserRow["role"], number> = {
  관리자: 0,
  승인자: 1,
  담당자: 2,
  "조회 사용자": 3,
}

const CURRENT_USER_STORAGE_KEY = "sw-manager-current-user-id"

type RoleContextValue = {
  currentUser: AppUserRow | null
  users: AppUserRow[]
  loading: boolean
  setCurrentUserId: (id: string) => void
  isAdmin: boolean
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AppUserRow[]>([])
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("app_users")
      .select("*")
      .eq("active", true)
      .then(({ data }) => {
        if (data) {
          const sorted = [...data].sort((a, b) => {
            const rankDiff = ROLE_RANK[a.role] - ROLE_RANK[b.role]
            return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name, "ko")
          })
          setUsers(sorted)
          const storedId = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY)
          const initial = sorted.find((u) => u.id === storedId) ?? sorted[0] ?? null
          setCurrentUserIdState(initial?.id ?? null)
        }
        setLoading(false)
      })
  }, [])

  const setCurrentUserId = useCallback((id: string) => {
    setCurrentUserIdState(id)
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, id)
  }, [])

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? null,
    [users, currentUserId],
  )

  const value = useMemo<RoleContextValue>(
    () => ({
      currentUser,
      users,
      loading,
      setCurrentUserId,
      isAdmin: currentUser?.role === "관리자",
    }),
    [currentUser, users, loading, setCurrentUserId],
  )

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used within RoleProvider")
  return ctx
}
```

- [ ] **Step 2: Create `user-switcher.tsx`**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, ShieldCheck, UserCog } from "lucide-react"
import { useRole } from "./role-context"
import { StatusBadge, type Accent } from "./ui"
import { cn } from "@/lib/utils"
import type { Tables } from "@/lib/supabase/types"

const ROLE_ACCENT: Record<Tables<"app_users">["role"], Accent> = {
  관리자: "primary",
  승인자: "review",
  담당자: "success",
  "조회 사용자": "muted",
}

export function UserSwitcher() {
  const { currentUser, users, isAdmin, setCurrentUserId } = useRole()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const Icon = isAdmin ? ShieldCheck : UserCog

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!currentUser}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors xl:px-3",
          open && "border-primary/50",
          !currentUser && "opacity-60",
        )}
        aria-label="로그인 사용자 전환"
        aria-expanded={open}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="hidden xl:inline">
          {currentUser ? `${currentUser.name} · ${currentUser.role}` : "불러오는 중…"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="animate-palette absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
          <div className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
            로그인 사용자 전환 (데모)
          </div>
          <div className="max-h-[24rem] overflow-y-auto">
            {users.map((user) => {
              const selected = user.id === currentUser?.id
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setCurrentUserId(user.id)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 border-b border-border/40 px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/40",
                    selected && "bg-primary/[0.06]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.dept}</p>
                  </div>
                  <StatusBadge accent={ROLE_ACCENT[user.role]}>{user.role}</StatusBadge>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              )
            })}
            {users.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                등록된 사용자가 없습니다.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Delete `role-toggle.tsx`**

```bash
git rm components/portal/role-toggle.tsx
```

- [ ] **Step 4: Wire `UserSwitcher` into the header**

In `components/portal/portal-header.tsx`, find:

```ts
import { RoleToggle } from "./role-toggle"
```

Replace with:

```ts
import { UserSwitcher } from "./user-switcher"
```

Find:

```tsx
        <RoleToggle />
```

Replace with:

```tsx
        <UserSwitcher />
```

- [ ] **Step 5: Update `sidebar.tsx` to use `currentUser` instead of the hardcoded map**

Find:

```ts
import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronsLeft, ChevronsRight, ShieldCheck, UserCog, X } from "lucide-react"
import { visibleNavItems, isNavGroup, type ViewKey } from "./nav"
import { useRole, type Role } from "./role-context"
import { cn } from "@/lib/utils"

const CURRENT_USER: Record<Role, { name: string; label: string }> = {
  admin: { name: "김관리", label: "관리자" },
  owner: { name: "정재율", label: "사용자" },
}
```

Replace with:

```ts
import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronsLeft, ChevronsRight, ShieldCheck, UserCog, X } from "lucide-react"
import { visibleNavItems, isNavGroup, type ViewKey } from "./nav"
import { useRole } from "./role-context"
import { cn } from "@/lib/utils"
```

Find:

```ts
  const { role, isAdmin } = useRole()
  const items = visibleNavItems(isAdmin)
  const currentUser = CURRENT_USER[role]
```

Replace with:

```ts
  const { currentUser, isAdmin } = useRole()
  const items = visibleNavItems(isAdmin)
```

Find:

```tsx
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-xs font-semibold text-white">
                {currentUser.name}
              </p>
              <p className="truncate text-[11px] text-slate-300/80">
                {currentUser.label}로 접속 중
              </p>
            </div>
```

Replace with:

```tsx
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <p className="truncate text-xs font-semibold text-white">
                {currentUser?.name ?? "-"}
              </p>
              <p className="truncate text-[11px] text-slate-300/80">
                {currentUser ? `${currentUser.role}로 접속 중` : "불러오는 중…"}
              </p>
            </div>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "role-context|user-switcher|sidebar\.tsx|portal-header"`
Expected: no output.

- [ ] **Step 7: Manual verification**

Run `pnpm dev`, open the app in a browser.

1. Confirm the old 관리자/사용자 pill toggle in the header is gone, replaced by a button showing a name + role.
2. Click the new button — confirm a popover opens listing every active `app_users` row, ordered 관리자 → 승인자 → 담당자 → 조회 사용자, each with a role-colored badge, and the currently-selected row has a checkmark.
3. Click a different 담당자 in the list — confirm: the popover closes, the button label updates, the sidebar footer name/role text updates immediately, and admin-only sidebar items disappear (since this person is not 관리자).
4. Click a 관리자 in the list — confirm admin-only sidebar items reappear.
5. Refresh the page (F5) — confirm the same user you last selected is still shown (not reset to the first user), because the choice is read from `localStorage`.
6. Open browser devtools → Application → Local Storage, confirm a `sw-manager-current-user-id` key holding a UUID.

- [ ] **Step 8: Commit**

```bash
git add components/portal/role-context.tsx components/portal/user-switcher.tsx components/portal/portal-header.tsx components/portal/sidebar.tsx
git commit -m "feat: replace admin/user role toggle with a real login-user switcher"
```

---

### Task 2: Filter notifications per logged-in user

**Files:**
- Modify: `components/portal/notifications-context.tsx`

**Interfaces:**
- Consumes: `useRole()` → `{ isAdmin, currentUser }` from Task 1.
- Produces: no change to `useNotifications()`'s public shape (`notifications`, `unreadCount`, `urgentCount`, `approvalCount`, `markRead`, `markAllRead`, `refresh`) — only the *contents* of `notifications` and the counts derived from it change (now scoped to the current user unless `isAdmin`).

- [ ] **Step 1: Import `useRole` and read `isAdmin`/`currentUser`**

Find:

```ts
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import type { Accent, RiskLevel } from "./ui"
import type { ViewKey } from "./nav"
```

Replace with:

```ts
import { createClient } from "@/lib/supabase/client"
import { useRole } from "./role-context"
import type { Tables } from "@/lib/supabase/types"
import type { Accent, RiskLevel } from "./ui"
import type { ViewKey } from "./nav"
```

Find:

```ts
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
```

Replace with:

```ts
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAdmin, currentUser } = useRole()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
```

- [ ] **Step 2: Derive a per-user visible list and scope `markAllRead` to it**

Find:

```ts
  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
    createClient().from("notifications").update({ read: true }).eq("id", id).then()
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    createClient().from("notifications").update({ read: true }).eq("read", false).then()
  }, [])

  const value = useMemo<NotificationsContextValue>(() => {
    const unreadCount = notifications.filter((n) => !n.read).length
    const urgentCount = notifications.filter((n) => n.urgent).length
    const approvalCount = notifications.filter(
      (n) => n.status === "승인대기",
    ).length
    return {
      notifications,
      loading,
      unreadCount,
      urgentCount,
      approvalCount,
      markRead,
      markAllRead,
      refresh,
    }
  }, [notifications, loading, markRead, markAllRead, refresh])
```

Replace with:

```ts
  const visible = useMemo(
    () => notifications.filter((n) => isAdmin || n.owner === currentUser?.name),
    [notifications, isAdmin, currentUser],
  )

  const markRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
    createClient().from("notifications").update({ read: true }).eq("id", id).then()
  }, [])

  const markAllRead = useCallback(() => {
    const targetIds = new Set(
      notifications
        .filter((n) => !n.read && (isAdmin || n.owner === currentUser?.name))
        .map((n) => n.id),
    )
    setNotifications((prev) =>
      prev.map((n) => (targetIds.has(n.id) ? { ...n, read: true } : n)),
    )
    const supabase = createClient()
    if (isAdmin) {
      supabase.from("notifications").update({ read: true }).eq("read", false).then()
    } else if (currentUser) {
      supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false)
        .eq("owner", currentUser.name)
        .then()
    }
  }, [notifications, isAdmin, currentUser])

  const value = useMemo<NotificationsContextValue>(() => {
    const unreadCount = visible.filter((n) => !n.read).length
    const urgentCount = visible.filter((n) => n.urgent).length
    const approvalCount = visible.filter(
      (n) => n.status === "승인대기",
    ).length
    return {
      notifications: visible,
      loading,
      unreadCount,
      urgentCount,
      approvalCount,
      markRead,
      markAllRead,
      refresh,
    }
  }, [visible, loading, markRead, markAllRead, refresh])
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "notifications-context"`
Expected: no output.

- [ ] **Step 4: Manual verification**

Requires at least two `notifications` rows in Supabase with different `owner` values (check via the notifications table or `notifications-view.tsx`). Run `pnpm dev`.

1. Use the user switcher (Task 1) to log in as a 담당자 whose name matches one of those `owner` values. Confirm the bell badge count and the notification list (bell dropdown + `notifications-view.tsx`) only show notifications where `owner` equals that name.
2. Switch to a 관리자 — confirm the full, unfiltered notification list reappears.
3. As the 담당자 from step 1, click "전체 읽음 처리" (mark all read) in the bell dropdown — confirm only that person's notifications flip to read (check another 담당자's notifications remain unread after switching to them).

- [ ] **Step 5: Commit**

```bash
git add components/portal/notifications-context.tsx
git commit -m "feat: scope notifications to the logged-in demo user"
```

---

### Task 3: Auto-filter "내 조치 업무" by the logged-in user, remove the manual dropdown

**Files:**
- Modify: `components/pages/patch-tasks-view.tsx`

**Interfaces:**
- Consumes: `useRole()` → `{ isAdmin, currentUser }` from Task 1.
- Produces: no new exports — `PatchTasksView` keeps its existing no-props signature.

- [ ] **Step 1: Drop the now-unused `AppUser` type alias**

Find:

```ts
type PatchTask = Tables<"patch_tasks">
type PatchTaskStatus = PatchTask["status"]
type AppUser = Tables<"app_users">
type Asset = Tables<"assets">
```

Replace with:

```ts
type PatchTask = Tables<"patch_tasks">
type PatchTaskStatus = PatchTask["status"]
type Asset = Tables<"assets">
```

- [ ] **Step 2: Read `currentUser`, drop `owners`/`ownerFilter` state**

Find:

```ts
export function PatchTasksView() {
  const { isAdmin } = useRole()
  const { toast } = useToast()
  const { vulns, assets, loading: noticeLoading } = useNoticeData()
  const [tasks, setTasks] = useState<PatchTask[]>([])
  const [owners, setOwners] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [ownerFilter, setOwnerFilter] = useState("전체")
  const [statusFilter, setStatusFilter] = useState<"전체" | PatchTaskStatus>("전체")
  const [severityFilter, setSeverityFilter] = useState<"전체" | Vulnerability["severity"]>("전체")
  const [editId, setEditId] = useState<string | null>(null)
```

Replace with:

```ts
export function PatchTasksView() {
  const { isAdmin, currentUser } = useRole()
  const { toast } = useToast()
  const { vulns, assets, loading: noticeLoading } = useNoticeData()
  const [tasks, setTasks] = useState<PatchTask[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"전체" | PatchTaskStatus>("전체")
  const [severityFilter, setSeverityFilter] = useState<"전체" | Vulnerability["severity"]>("전체")
  const [editId, setEditId] = useState<string | null>(null)
```

- [ ] **Step 3: Remove the `app_users` fetch**

Find:

```ts
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("patch_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setTasks(data)
        setLoading(false)
      })
    supabase
      .from("app_users")
      .select("*")
      .eq("role", "담당자")
      .eq("active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setOwners(data)
      })
  }, [])
```

Replace with:

```ts
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("patch_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setTasks(data)
        setLoading(false)
      })
  }, [])
```

- [ ] **Step 4: Auto-filter by the logged-in 담당자 instead of the dropdown value**

Find:

```ts
    if (ownerFilter !== "전체" && task.owner !== ownerFilter) return false
```

Replace with:

```ts
    if (currentUser?.role === "담당자" && task.owner !== currentUser.name) return false
```

- [ ] **Step 5: Replace the owner dropdown UI with a status line**

Find:

```tsx
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">담당자</span>
            <select
              value={ownerFilter}
              onChange={(e) => { setOwnerFilter(e.target.value); pagination.setPage(1) }}
              className="rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
            >
              <option value="전체">전체</option>
              {owners.map((o) => (
                <option key={o.id} value={o.name}>{o.name}</option>
              ))}
            </select>
            {!isAdmin ? (
              <span className="text-[11px] text-muted-foreground">
                실제 로그인이 없어 본인 이름을 선택하면 "조치 등록" 버튼이 활성화됩니다.
              </span>
            ) : null}
          </div>
```

Replace with:

```tsx
          {currentUser?.role === "담당자" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                담당자: <span className="font-medium text-foreground">{currentUser.name}</span> 님의 조치 건만 표시됩니다.
              </span>
            </div>
          ) : null}
```

- [ ] **Step 6: Base `canEdit` on the logged-in role instead of the dropdown**

Find:

```ts
              const canEdit = !isAdmin && ownerFilter !== "전체"
```

Replace with:

```ts
              const canEdit = currentUser?.role === "담당자"
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "patch-tasks-view"`
Expected: no output.

- [ ] **Step 8: Manual verification**

Requires at least one `patch_tasks` row whose `owner` matches an active 담당자's name in `app_users`. Run `pnpm dev`.

1. Use the user switcher to log in as that 담당자. Navigate to "내 조치 업무" — confirm only rows where `owner` equals this person's name are shown, the "담당자: OOO 님의 조치 건만 표시됩니다" line appears, and every visible row has a "조치 등록" button (no dropdown anywhere on the page).
2. Click "조치 등록" on a row, save a change — confirm it still saves normally (unaffected by this task).
3. Switch to a different 담당자 with different assigned rows — confirm the list changes to that person's rows.
4. Switch to 관리자 — confirm all rows are visible again, no "조치 등록" buttons appear (except 예외요청 rows showing 승인/반려, unaffected by this task), and the "담당자: ..." line is gone.
5. Switch to 승인자 or 조회 사용자 — confirm the same read-only, unfiltered behavior as 관리자 minus the 예외요청 승인/반려 buttons (those stay `isAdmin`-gated).

- [ ] **Step 9: Commit**

```bash
git add components/pages/patch-tasks-view.tsx
git commit -m "feat: auto-filter 내 조치 업무 by the logged-in user, drop manual owner dropdown"
```

---

## Post-plan CLAUDE.md update

After all three tasks are committed, update `CLAUDE.md`:

- In the "Navigation & RBAC" section, replace "Role state lives in `RoleProvider` (`components/portal/role-context.tsx`). Currently defaults to `"admin"` and is toggled via `RoleToggle` in the header — no real auth." with a description of the new switcher: `RoleProvider` now sources `currentUser`/`users` from the `app_users` table (active rows only, role-ranked), the header's `UserSwitcher` (`components/portal/user-switcher.tsx`) lets the operator pick any of them, the choice persists via `localStorage["sw-manager-current-user-id"]`, and `isAdmin` derives from `currentUser?.role === "관리자"` — still no real auth (separate from `AuthGate` in `app/page.tsx`).
- In the `patch-tasks-view.tsx` description, remove the "실제 로그인이 없어(`role-context.tsx`) '본인 건만'은 `app_users`(역할=담당자) 기반 담당자 드롭다운으로 시뮬레이션" sentence and replace it with: rows auto-filter to the logged-in user's own `owner` name when `currentUser.role === "담당자"`; other roles see everything read-only, same as before.
- Note under `NotificationsProvider` that the notification list/badge counts are now scoped to `notifications.owner === currentUser?.name` unless `isAdmin` (approximate string match, no real recipient column).
