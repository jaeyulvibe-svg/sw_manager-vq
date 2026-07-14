# 담당자 조치 현황 — 예외요청/승인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a patch-task owner mark a ticket as "조치 불필요" (예외요청) with a mandatory reason, and let an admin approve (close the ticket) or reject (send it back to 조치예정) directly from the existing "내 조치 업무" screen — while also making 기한 mandatory when an owner registers 조치예정.

**Architecture:** Two new terminal-ish status values (`예외요청`, `예외승인`) are added to `patch_tasks.status`'s existing check constraint — no new columns, no new table, no new screen. `patch-tasks-view.tsx`'s existing owner-facing `EditPanel` gains inline validation (blocks save via a `toast` instead of a schema library, matching this file's existing error-handling style), and its existing 관리 column gains a conditional admin-only 승인/반려 button pair, styled identically to `approval-view.tsx`'s existing 승인/반려 buttons.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (`@supabase/supabase-js` via `@supabase/ssr`), TypeScript, Tailwind.

## Global Constraints

- No test suite is configured in this repo (`CLAUDE.md`) — every "verify" step below is `npx tsc --noEmit` (filtered to touched files) plus a manual check, not an automated test run. Do not add a test framework as part of this plan.
- `next.config.mjs` has `typescript.ignoreBuildErrors: true`, so `npx tsc --noEmit` is the only thing that will actually catch type errors — always run it before committing a task.
- This project has no Supabase CLI link and no DB connection string in `.env.local`. SQL migration files are applied manually by the user pasting them into the Supabase SQL editor — Task 1 ends with a manual-apply instruction, not an automated migration run.
- Follow existing code conventions exactly: Korean UI strings, `MiniButton`/`SectionCard`/`StatusBadge`/`TableShell`/`usePagination` from `@/components/portal/ui`, `useToast()` for feedback, `cn()` from `@/lib/utils`, immediate-reflect CRUD (call `supabase` directly from the client component, no separate API layer).
- Do not add: 담당자 변경, 조치완료 건에 대한 관리자 최종 승인 절차, 예외요청 반려 시 관리자 반려 사유 입력 — these are explicitly out of scope per the design doc (`docs/superpowers/specs/2026-07-14-patch-tasks-exception-design.md`).
- Reject does not clear `note` — the previous exception reason stays visible for context if the owner re-requests.

---

### Task 1: `patch_tasks.status` gains `예외요청`/`예외승인` + generated types

**Files:**
- Create: `supabase/migrations/016_patch_tasks_exception.sql`
- Modify: `lib/supabase/types.ts:440`, `:452`, `:460`

**Interfaces:**
- Produces: `Tables<"patch_tasks">["status"]` widens to `"배정됨" | "조치예정" | "조치지연" | "조치완료" | "예외요청" | "예외승인"`. Task 2 consumes this type for `EDIT_STATUS_OPTIONS`, `STATUS_FILTERS`, and `statusAccent`.

- [ ] **Step 1: Write the migration file**

```sql
-- 담당자 조치 현황 — 예외요청/승인 (2차 스코프)
-- 조치가 불필요/보류로 판단되는 건을 담당자가 예외요청(사유 필수)하고,
-- 관리자가 승인(종결)하거나 반려(조치예정으로 복귀)할 수 있도록
-- status check 제약에 두 값을 추가한다.

alter table public.patch_tasks drop constraint if exists patch_tasks_status_check;
alter table public.patch_tasks add constraint patch_tasks_status_check
  check (status in ('배정됨','조치예정','조치지연','조치완료','예외요청','예외승인'));
```

- [ ] **Step 2: Widen the `status` union in `lib/supabase/types.ts`**

Find (three occurrences in the `patch_tasks` block — `Row`, `Insert`, `Update`):

```ts
          status: "배정됨" | "조치예정" | "조치지연" | "조치완료"
```

Replace with:

```ts
          status: "배정됨" | "조치예정" | "조치지연" | "조치완료" | "예외요청" | "예외승인"
```

Find:

```ts
          status?: "배정됨" | "조치예정" | "조치지연" | "조치완료"
```

This appears twice (once in `Insert`, once in `Update`). Replace **both** with:

```ts
          status?: "배정됨" | "조치예정" | "조치지연" | "조치완료" | "예외요청" | "예외승인"
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "lib/supabase/types.ts"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/016_patch_tasks_exception.sql lib/supabase/types.ts
git commit -m "feat: add 예외요청/예외승인 status values to patch_tasks"
```

- [ ] **Step 5: Tell the user to apply the migration**

Tell the user: "`016_patch_tasks_exception.sql`을 Supabase SQL 편집기에서 실행해주세요 — 이전 마이그레이션들과 동일하게 수동 적용이 필요합니다." Do not treat `예외요청`/`예외승인` as writable in the live DB until the user confirms — Task 2's manual-verification steps assume the constraint is applied.

---

### Task 2: `patch-tasks-view.tsx` — validation + 예외요청 + admin 승인/반려

**Files:**
- Modify: `components/pages/patch-tasks-view.tsx`

**Interfaces:**
- Consumes: `Tables<"patch_tasks">["status"]` widened in Task 1.
- Produces: no new exports — `PatchTasksView` keeps its existing no-props signature.

- [ ] **Step 1: Import `Check`/`X` icons for the admin action buttons**

Find:

```ts
import {
  ListChecks,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Search,
} from "lucide-react"
```

Replace with:

```ts
import {
  ListChecks,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Search,
  Check,
  X,
} from "lucide-react"
```

- [ ] **Step 2: Add the two new statuses to the filter list, edit options, and accent map**

Find:

```ts
const STATUS_FILTERS: ("전체" | PatchTaskStatus)[] = ["전체", "배정됨", "조치예정", "조치지연", "조치완료"]
const SEVERITY_FILTERS: ("전체" | Vulnerability["severity"])[] = ["전체", "Critical", "High", "Medium", "Low"]
const EDIT_STATUS_OPTIONS: PatchTaskStatus[] = ["조치예정", "조치지연", "조치완료"]

const statusAccent: Record<PatchTaskStatus, Accent> = {
  배정됨: "muted",
  조치예정: "primary",
  조치지연: "warning",
  조치완료: "success",
}
```

Replace with:

```ts
const STATUS_FILTERS: ("전체" | PatchTaskStatus)[] = ["전체", "배정됨", "조치예정", "조치지연", "조치완료", "예외요청", "예외승인"]
const SEVERITY_FILTERS: ("전체" | Vulnerability["severity"])[] = ["전체", "Critical", "High", "Medium", "Low"]
const EDIT_STATUS_OPTIONS: PatchTaskStatus[] = ["조치예정", "조치지연", "조치완료", "예외요청"]

const statusAccent: Record<PatchTaskStatus, Accent> = {
  배정됨: "muted",
  조치예정: "primary",
  조치지연: "warning",
  조치완료: "success",
  예외요청: "review",
  예외승인: "muted",
}
```

`예외승인`은 관리자 액션으로만 도달하므로 `EDIT_STATUS_OPTIONS`(담당자용 셀렉트)에는 넣지 않는다.

- [ ] **Step 3: Add validation + admin approve/reject handlers to `saveTask`**

Find:

```ts
  async function saveTask(taskId: string, values: EditValues) {
    const supabase = createClient()
    const patch = {
      status: values.status,
      due_date: values.due_date || null,
      note: values.note || null,
      completed_at: values.status === "조치완료" ? new Date().toISOString() : null,
    }
    const { error } = await supabase.from("patch_tasks").update(patch).eq("id", taskId)
    if (error) {
      toast({ tone: "danger", title: "저장 실패", description: error.message })
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
    setEditId(null)
    toast({ tone: "success", title: "조치 내용이 저장되었습니다" })
  }
```

Replace with:

```ts
  async function saveTask(taskId: string, values: EditValues) {
    if (values.status === "조치예정" && !values.due_date) {
      toast({ tone: "danger", title: "기한을 입력해주세요", description: "조치예정 상태는 기한이 필수입니다." })
      return
    }
    if (values.status === "예외요청" && !values.note.trim()) {
      toast({ tone: "danger", title: "사유를 입력해주세요", description: "예외요청은 메모(사유)가 필수입니다." })
      return
    }
    const supabase = createClient()
    const patch = {
      status: values.status,
      due_date: values.due_date || null,
      note: values.note || null,
      completed_at: values.status === "조치완료" ? new Date().toISOString() : null,
    }
    const { error } = await supabase.from("patch_tasks").update(patch).eq("id", taskId)
    if (error) {
      toast({ tone: "danger", title: "저장 실패", description: error.message })
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
    setEditId(null)
    toast({ tone: "success", title: "조치 내용이 저장되었습니다" })
  }

  async function approveException(taskId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("patch_tasks").update({ status: "예외승인" }).eq("id", taskId)
    if (error) {
      toast({ tone: "danger", title: "승인 실패", description: error.message })
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "예외승인" } : t)))
    toast({ tone: "success", title: "예외요청을 승인했습니다" })
  }

  async function rejectException(taskId: string) {
    const supabase = createClient()
    const { error } = await supabase.from("patch_tasks").update({ status: "조치예정" }).eq("id", taskId)
    if (error) {
      toast({ tone: "danger", title: "반려 실패", description: error.message })
      return
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "조치예정" } : t)))
    toast({ tone: "success", title: "예외요청을 반려했습니다" })
  }
```

Validation blocks the save and returns before the panel closes (`setEditId(null)` is never reached), so the owner sees the toast and can fix the field without losing their input.

- [ ] **Step 4: Show admin 승인/반려 buttons on `예외요청` rows**

Find:

```tsx
                  <Td>
                    {canEdit ? (
                      <MiniButton accent="primary" onClick={() => setEditId(task.id)}>
                        조치 등록
                      </MiniButton>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </Td>
```

Replace with:

```tsx
                  <Td>
                    {isAdmin && task.status === "예외요청" ? (
                      <div className="flex items-center gap-1.5">
                        <MiniButton accent="success" onClick={() => approveException(task.id)}>
                          <Check className="h-3 w-3" />승인
                        </MiniButton>
                        <MiniButton accent="destructive" onClick={() => rejectException(task.id)}>
                          <X className="h-3 w-3" />반려
                        </MiniButton>
                      </div>
                    ) : canEdit ? (
                      <MiniButton accent="primary" onClick={() => setEditId(task.id)}>
                        조치 등록
                      </MiniButton>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </Td>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep "patch-tasks-view"`
Expected: no output.

- [ ] **Step 6: Manual verification**

Requires Task 1's migration applied and at least one existing `patch_tasks` row (담당자 role, pick a matching 담당자 in the filter, `조치 등록` on any row). Run `pnpm dev`:

1. As 담당자, open the edit panel, set 상태 `조치예정`, leave 기한 blank, click 저장 — confirm a danger toast ("기한을 입력해주세요") appears and the panel stays open.
2. Set 상태 `예외요청`, leave 메모 blank, click 저장 — confirm a danger toast ("사유를 입력해주세요") appears and the panel stays open.
3. Fill in 메모 with a reason, click 저장 — confirm it saves, the panel closes, and the row shows an `예외요청` badge (review color, not primary/warning/success).
4. Toggle role to 관리자 — confirm that row's 관리 column shows 승인/반려 buttons (green check / red X) instead of "-", and no other row shows these buttons.
5. Click 승인 — confirm the row updates to `예외승인` (muted badge) immediately with a success toast. Refresh — confirm it persisted.
6. Repeat steps 1–3 on a different row, then as 관리자 click 반려 — confirm the row goes back to `조치예정` and the 메모 (previous reason) is still visible in the 메모 column.
7. Use the 상태 filter row to filter by `예외요청` and `예외승인` individually — confirm each shows only the matching row(s).

- [ ] **Step 7: Commit**

```bash
git add components/pages/patch-tasks-view.tsx
git commit -m "feat: add 예외요청/승인 flow to 내 조치 업무 with due-date and reason validation"
```

---

## Post-plan CLAUDE.md update

After both tasks are committed, extend `CLAUDE.md`'s `patch-tasks-view.tsx` description to mention: 조치예정 등록 시 기한 필수, 예외요청 등록 시 메모(사유) 필수, 그리고 관리자가 예외요청 건에 한해 승인(→예외승인, 종결)/반려(→조치예정 복귀)할 수 있다는 것. Also update the "미구현" parenthetical — remove 예외요청 from the list of unimplemented items, keep 담당자변경/완료확인 as still unimplemented.
