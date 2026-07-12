# SW 마스터 조회/편집 상태 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SW 마스터 테이블의 분류/수집모드/사용여부 셀을 조회 상태(배지·캡슐)와 편집 상태(드롭다운·선택 컨트롤)로 분리하고, 컬럼 폭/정렬/툴팁/날짜 포맷을 정리한다.

**Architecture:** 기존 draft-then-commit 저장 흐름(`use-master-draft.ts`)은 그대로 두고, `SwMasterView`에 `editingRowId` state를 추가해 순수 표시 토글로만 조회/편집을 분기한다. `cells.tsx`에 조회용 배지/캡슐 컴포넌트 3종을 새로 추가하고, 기존 `EditableCategory`/`EditableCollectMode`/`ActiveToggle`은 `editingRowId === row.id`일 때만 렌더링한다.

**Tech Stack:** Next.js (App Router, single-page client component), Tailwind CSS, lucide-react, TypeScript. 이 저장소에는 테스트 스위트가 없음(`CLAUDE.md`: "No test suite is configured", `next.config.mjs`에 `typescript.ignoreBuildErrors: true`) — 따라서 각 태스크의 검증은 자동 테스트 대신 `pnpm lint` + `pnpm dev`를 통한 수동 시각 확인으로 대체한다.

## Global Constraints

- 데이터/저장 흐름 변경 없음: `draft.editCell`/`draft.commit`/저장 확인 모달은 그대로. 모든 편집은 draft에만 반영되고 저장 버튼을 눌러야 DB에 반영된다.
- 배지 색상은 정확한 헥스값으로 지정한다: AUTO `#7C3AED`/`#F5F3FF`/`#C4B5FD`, SEMI_AUTO `#2563EB`/`#EFF6FF`/`#BFDBFE`, MANUAL `#475569`/`#F8FAFC`/`#CBD5E1`, 사용 `#15803D`/`#F0FDF4`/`#BBF7D0`, 미사용 `#64748B`/`#F8FAFC`/`#CBD5E1` (glass text/bg/border 순).
- 배지 크기: `h-7`(28px), `px-2.5`(10px), `rounded-lg`(8px), `text-[13px] font-bold`.
- 최근 갱신일 포맷: `YYYY.MM.DD HH:mm` 24시간제(예: `2026.07.12 02:13`) — `Intl`/`toLocaleString`의 ko-KR 로캘 구분자에 의존하지 않고 직접 포맷한다(로캘 포맷은 점 뒤에 공백이 붙어 요청 형식과 다름).
- 엑셀 다운로드(`ExportExcelButton`)와 `draft` 내부 값은 항상 순수 문자열/불리언 그대로 유지 — 배지·아이콘 컴포넌트는 표시 전용이며 이 값들을 건드리지 않는다.
- 커밋은 태스크 단위로 나눠서 만든다(`git commit`은 각 태스크 마지막 단계).

---

## File Structure

- `components/pages/sw-master/cells.tsx` — 수정: 조회 전용 배지/캡슐 컴포넌트 3종(`CollectModeBadge`, `UseStatusBadge`, `CategoryCell`) 추가, `RowMenu`에 편집 토글 항목 추가, `EditableText`/`EditableVendor`에 툴팁 지원 추가.
- `components/pages/sw-master-view.tsx` — 수정: `editingRowId` state, 더블클릭/바깥클릭 처리, 조회·편집 분기 렌더링, 일괄 수정 컨트롤, 컬럼 폭 기본값, 정렬 클래스.
- `components/pages/sw-master/use-master-draft.ts` — 수정: `formatDateTime` 헬퍼 추가(export).

---

### Task 1: 조회 전용 배지·캡슐 컴포넌트 추가

**Files:**
- Modify: `components/pages/sw-master/cells.tsx`

**Interfaces:**
- Produces: `CollectModeBadge({ value }: { value: EditableFields["collect_mode"] })`, `UseStatusBadge({ value }: { value: boolean })`, `CategoryCell({ value }: { value: EditableFields["category"] })` — 모두 `cells.tsx`에서 `export function`으로 export.
- Consumes: 기존 `EditableFields`, `COLLECT_MODES`, `CATEGORY_ICONS`, `cn` (이미 파일 상단에 임포트됨).

- [ ] **Step 1: `COLLECT_MODE_HINT` 정의 바로 아래에 배지 스타일 맵과 `CollectModeBadge`를 추가한다**

`components/pages/sw-master/cells.tsx`의 150-154번 줄(`COLLECT_MODE_HINT` 정의) 바로 다음에 삽입:

```tsx
const COLLECT_MODE_BADGE_STYLE: Record<(typeof COLLECT_MODES)[number], string> = {
  AUTO: "text-[#7C3AED] bg-[#F5F3FF] border-[#C4B5FD]",
  SEMI_AUTO: "text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE]",
  MANUAL: "text-[#475569] bg-[#F8FAFC] border-[#CBD5E1]",
}

const badgeBase = "inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg border px-2.5 text-[13px] font-bold leading-none"

/* ---- 수집 모드 배지(조회 전용) ---- */
export function CollectModeBadge({ value }: { value: EditableFields["collect_mode"] }) {
  return (
    <span title={COLLECT_MODE_HINT[value]} className={cn(badgeBase, COLLECT_MODE_BADGE_STYLE[value])}>
      {value}
    </span>
  )
}

const USE_STATUS_BADGE_STYLE: Record<"사용" | "미사용", string> = {
  사용: "text-[#15803D] bg-[#F0FDF4] border-[#BBF7D0]",
  미사용: "text-[#64748B] bg-[#F8FAFC] border-[#CBD5E1]",
}

/* ---- 사용 여부 배지(조회 전용) ---- */
export function UseStatusBadge({ value }: { value: boolean }) {
  const label = value ? "사용" : "미사용"
  return <span className={cn(badgeBase, USE_STATUS_BADGE_STYLE[label])}>{label}</span>
}

/* ---- 분류 캡슐(조회 전용, 중립색) ---- */
export function CategoryCell({ value }: { value: EditableFields["category"] }) {
  const Icon = CATEGORY_ICONS[value]
  return (
    <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-border/50 bg-muted/40 px-2.5 text-xs font-medium text-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {value}
    </span>
  )
}
```

- [ ] **Step 2: 타입 체크로 확인**

Run: `pnpm lint`
Expected: 에러 없음 (경고만 있다면 기존에 있던 것인지 `git stash`로 비교해 확인).

- [ ] **Step 3: 커밋**

```bash
git add components/pages/sw-master/cells.tsx
git commit -m "feat: SW 마스터 조회 전용 배지·캡슐 컴포넌트 추가"
```

---

### Task 2: 조회 ↔ 편집 상태 분리 (편집 진입: 더보기 메뉴 / 더블클릭)

**Files:**
- Modify: `components/pages/sw-master/cells.tsx` (RowMenu)
- Modify: `components/pages/sw-master-view.tsx`

**Interfaces:**
- Consumes: Task 1의 `CollectModeBadge`, `UseStatusBadge`, `CategoryCell`.
- Produces: `RowMenu`에 새 필수 prop `editing: boolean`, `onToggleEdit: () => void` 추가(기존 `onDetail`/`onDuplicate`/`onToggleDelete`/`onRevert`는 유지). `SwMasterView` 내부에 `editingRowId: string | null` state — 이후 태스크에서는 참조하지 않음(이 컴포넌트 로컬 상태로 끝).

- [ ] **Step 1: `cells.tsx`의 `lucide-react` import에 `Pencil`, `Check` 추가**

`cells.tsx` 4-19번 줄의 import를 다음으로 교체:

```tsx
import {
  Eye,
  Copy,
  Trash2,
  Undo2,
  RotateCcw,
  MoreVertical,
  X,
  Pencil,
  Check,
  Monitor,
  Globe,
  Server,
  Database,
  Layers,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
```

- [ ] **Step 2: `RowMenu`에 편집 토글 항목 추가**

`cells.tsx`의 `RowMenu` 함수 시그니처(252-264번 줄)를 다음으로 교체:

```tsx
export function RowMenu({
  row,
  editing,
  onToggleEdit,
  onDetail,
  onDuplicate,
  onToggleDelete,
  onRevert,
}: {
  row: EffectiveRow
  editing: boolean
  onToggleEdit: () => void
  onDetail: () => void
  onDuplicate: () => void
  onToggleDelete: () => void
  onRevert: () => void
}) {
```

같은 함수 내부, 메뉴가 열렸을 때(290번 줄 `{open ? (` 다음) "상세 보기" 버튼 바로 앞에 편집 토글 버튼을 추가한다. 291-302번 줄을 다음으로 교체:

```tsx
        <div className="absolute left-0 top-7 z-50 w-40 rounded-xl border border-border/70 bg-card py-1 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              onToggleEdit()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent/60"
          >
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? "편집 완료" : "편집"}
          </button>
          <button
            type="button"
            onClick={() => {
              onDetail()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent/60"
          >
            <Eye className="h-3.5 w-3.5" />
            상세 보기
          </button>
```

- [ ] **Step 3: `sw-master-view.tsx`에 `editingRowId` state와 바깥클릭 처리 추가**

`sw-master-view.tsx`의 245-246번 줄(`const rowRefs = ...` / `const [highlightId, ...`) 바로 다음에 추가:

```tsx
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
```

262-259번 줄 근처, 기존 `colMenuRef` 바깥클릭 `useEffect`(253-259번 줄) 바로 다음에 새 `useEffect`를 추가:

```tsx
  useEffect(() => {
    if (!editingRowId) return
    function onClickOutside(e: MouseEvent) {
      const el = rowRefs.current.get(editingRowId)
      if (el && !el.contains(e.target as Node)) setEditingRowId(null)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [editingRowId])
```

- [ ] **Step 4: `<tr>`에 더블클릭 핸들러 추가**

`sw-master-view.tsx`의 765-771번 줄(`<tr key={row.id} ref={...}`) 를 다음으로 교체:

```tsx
                <tr
                  key={row.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(row.id, el)
                    else rowRefs.current.delete(row.id)
                  }}
                  onDoubleClick={() => setEditingRowId((prev) => (prev === row.id ? null : row.id))}
```

(이후 `className={cn(...)}` 부분은 그대로 유지)

- [ ] **Step 5: `RowMenu` 호출부에 새 prop 전달**

`sw-master-view.tsx`의 794-801번 줄을 다음으로 교체:

```tsx
                  <Td>
                    <RowMenu
                      row={row}
                      editing={editingRowId === row.id}
                      onToggleEdit={() => setEditingRowId((prev) => (prev === row.id ? null : row.id))}
                      onDetail={() => setDetailRow(row)}
                      onDuplicate={() => draft.duplicateRow(row.id)}
                      onToggleDelete={() => (row.status === "deleted" ? draft.undoDelete(row.id) : draft.markDeleted(row.id))}
                      onRevert={() => draft.revertRow(row.id)}
                    />
                  </Td>
```

- [ ] **Step 6: 분류 셀을 조회/편집 분기로 교체**

`sw-master-view.tsx`의 839-847번 줄을 다음으로 교체:

```tsx
                  {show("category") && (
                    <Td
                      className="text-center"
                      style={{ width: getColWidth("category"), minWidth: getColWidth("category"), maxWidth: getColWidth("category") }}
                    >
                      <div className="flex items-center justify-center">
                        {editingRowId === row.id ? (
                          <EditableCategory
                            value={row.values.category}
                            onChange={(v) => draft.editCell(row.id, "category", v)}
                            dirty={row.dirtyFields.has("category")}
                          />
                        ) : (
                          <CategoryCell value={row.values.category} />
                        )}
                      </div>
                    </Td>
                  )}
```

- [ ] **Step 7: 수집 모드 셀을 조회/편집 분기로 교체**

`sw-master-view.tsx`의 859-867번 줄을 다음으로 교체:

```tsx
                  {show("collect_mode") && (
                    <Td
                      className="text-center"
                      style={{ width: getColWidth("collect_mode"), minWidth: getColWidth("collect_mode"), maxWidth: getColWidth("collect_mode") }}
                    >
                      <div className="flex items-center justify-center">
                        {editingRowId === row.id ? (
                          <EditableCollectMode
                            value={row.values.collect_mode}
                            onChange={(v) => draft.editCell(row.id, "collect_mode", v)}
                            dirty={row.dirtyFields.has("collect_mode")}
                          />
                        ) : (
                          <CollectModeBadge value={row.values.collect_mode} />
                        )}
                      </div>
                    </Td>
                  )}
```

- [ ] **Step 8: 사용 여부 셀을 조회/편집 분기로 교체**

`sw-master-view.tsx`의 868-876번 줄을 다음으로 교체:

```tsx
                  {show("active") && (
                    <Td
                      className="text-center"
                      style={{ width: getColWidth("active"), minWidth: getColWidth("active"), maxWidth: getColWidth("active") }}
                    >
                      <div className="flex items-center justify-center">
                        {editingRowId === row.id ? (
                          <ActiveToggle
                            value={row.values.active}
                            onChange={(v) => draft.editCell(row.id, "active", v)}
                            dirty={row.dirtyFields.has("active")}
                          />
                        ) : (
                          <UseStatusBadge value={row.values.active} />
                        )}
                      </div>
                    </Td>
                  )}
```

- [ ] **Step 9: import 목록에 새 컴포넌트 추가**

`sw-master-view.tsx`의 32-42번 줄 import를 다음으로 교체:

```tsx
import {
  EditableText,
  EditableVendor,
  EditableCategory,
  EditableCollectMode,
  ActiveToggle,
  RowStatusBadge,
  RowMenu,
  MasterDetailModal,
  CATEGORY_ICONS,
  CollectModeBadge,
  UseStatusBadge,
  CategoryCell,
} from "@/components/pages/sw-master/cells"
```

- [ ] **Step 10: 빌드 확인**

Run: `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 11: 수동 시각 확인**

Run: `pnpm dev` (백그라운드로 실행 중이 아니라면), 브라우저에서 `http://localhost:3000` → SW 마스터 관리 화면 진입.
확인 항목:
1. 기본 조회 상태에서 분류/수집모드/사용여부가 드롭다운 화살표·토글 없이 배지/캡슐로만 보인다.
2. 임의의 행에서 더보기(⋮) 메뉴 → "편집" 클릭 → 그 행의 세 셀만 드롭다운/토글로 바뀐다.
3. 같은 행에서 다시 더보기 → "편집 완료" 클릭 → 배지로 돌아온다.
4. 다른 행을 더블클릭 → 편집 상태가 그 행으로 넘어가고 이전 행은 자동으로 조회 상태로 돌아온다(동시에 한 행만 편집).
5. 편집 중인 행 바깥(테이블 다른 영역, 예: 페이지네이션)을 클릭 → 편집 상태가 닫힌다.
6. 편집 상태에서 값을 바꾼 뒤 저장 버튼을 누르지 않고 새로고침하면(또는 "취소") 반영되지 않는다 — 기존 draft 동작 그대로인지 확인.

- [ ] **Step 12: 커밋**

```bash
git add components/pages/sw-master/cells.tsx components/pages/sw-master-view.tsx
git commit -m "feat: SW 마스터 분류·수집모드·사용여부 조회/편집 상태 분리"
```

---

### Task 3: 선택 후 일괄 수정 컨트롤 추가

**Files:**
- Modify: `components/pages/sw-master-view.tsx`

**Interfaces:**
- Consumes: 기존 `draft.editCell(id, field, value)`, `selected: Set<string>`, `MASTER_CATEGORIES`, `COLLECT_MODES`.
- Produces: 없음(이 화면 로컬 UI로 종료).

- [ ] **Step 1: 일괄 수정 로컬 state 추가**

`sw-master-view.tsx`의 233번 줄(`const [selected, setSelected] = useState<Set<string>>(new Set())`) 바로 다음에 추가:

```tsx
  const [bulkCategory, setBulkCategory] = useState<"" | EditableFields["category"]>("")
  const [bulkMode, setBulkMode] = useState<"" | (typeof COLLECT_MODES)[number]>("")
  const [bulkActive, setBulkActive] = useState<"" | "사용" | "미사용">("")
```

- [ ] **Step 2: 일괄 적용 핸들러 추가**

`sw-master-view.tsx`의 `handleBulkDelete` 함수(359-362번 줄) 바로 다음에 추가:

```tsx
  function handleBulkApply() {
    if (bulkCategory) selected.forEach((id) => draft.editCell(id, "category", bulkCategory))
    if (bulkMode) selected.forEach((id) => draft.editCell(id, "collect_mode", bulkMode))
    if (bulkActive) selected.forEach((id) => draft.editCell(id, "active", bulkActive === "사용"))
    setBulkCategory("")
    setBulkMode("")
    setBulkActive("")
  }
```

- [ ] **Step 3: 선택/일괄 작업 바에 3개 select + 적용 버튼 추가**

`sw-master-view.tsx`의 613-624번 줄(선택/일괄 작업 바 왼쪽 그룹)을 다음으로 교체:

```tsx
      {/* 선택/일괄 작업 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-accent/8 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 ? (
            <span className="text-xs font-semibold text-primary">{selected.size}개 선택됨</span>
          ) : (
            <span className="text-xs text-muted-foreground">총 {sorted.length}건</span>
          )}
          {selected.size > 0 ? (
            <>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value as typeof bulkCategory)}
                className="rounded-lg border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              >
                <option value="">분류 변경 안 함</option>
                {MASTER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={bulkMode}
                onChange={(e) => setBulkMode(e.target.value as typeof bulkMode)}
                className="rounded-lg border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              >
                <option value="">수집 모드 변경 안 함</option>
                {COLLECT_MODES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={bulkActive}
                onChange={(e) => setBulkActive(e.target.value as typeof bulkActive)}
                className="rounded-lg border border-border/60 bg-background/50 px-2 py-1.5 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              >
                <option value="">사용 여부 변경 안 함</option>
                <option value="사용">사용</option>
                <option value="미사용">미사용</option>
              </select>
              <MiniButton
                accent="primary"
                onClick={handleBulkApply}
                disabled={!bulkCategory && !bulkMode && !bulkActive}
              >
                적용
              </MiniButton>
            </>
          ) : null}
          <MiniButton accent="destructive" onClick={handleBulkDelete} disabled={selected.size === 0}>
            삭제
          </MiniButton>
        </div>
```

(바 우측의 "추가"/"컬럼 설정" 그룹은 그대로 유지)

- [ ] **Step 4: 빌드 확인**

Run: `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 5: 수동 시각 확인**

`pnpm dev` → SW 마스터 화면에서 체크박스로 2개 이상 행 선택 → 선택/일괄 작업 바에 분류/수집모드/사용여부 select 3개와 "적용" 버튼이 나타나는지 확인 → 수집 모드를 "MANUAL"로 선택 후 적용 → 선택된 행들의 수집 모드 배지가 모두 MANUAL로 바뀌고(변경됨 표시: 행 왼쪽 "수정됨" 배지), 저장 전에는 DB에 반영되지 않는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add components/pages/sw-master-view.tsx
git commit -m "feat: SW 마스터 선택 후 분류·수집모드·사용여부 일괄 수정 추가"
```

---

### Task 4: 컬럼 폭 기본값 및 셀 정렬 조정

**Files:**
- Modify: `components/pages/sw-master-view.tsx`

**Interfaces:** 없음(로컬 상수/클래스 변경).

- [ ] **Step 1: `DEFAULT_COL_WIDTHS` 갱신**

`sw-master-view.tsx`의 81-94번 줄을 다음으로 교체:

```tsx
const DEFAULT_COL_WIDTHS: Record<ColKey, number> = {
  id: 140,
  name: 220,
  vendor: 180,
  category: 150,
  std_version: 120,
  collect_mode: 150,
  active: 110,
  updated_at: 170,
  manager: 110,
  updated_by: 100,
  created_at: 110,
  note: 160,
}
```

- [ ] **Step 2: 선택/행메뉴 헤더 폭을 48px로 확대**

`sw-master-view.tsx`의 687-696번 줄을 다음으로 교체:

```tsx
            <Th className="w-12 bg-accent/15">
              <input
                type="checkbox"
                checked={sorted.length > 0 && selected.size === sorted.length}
                onChange={toggleSelectAll}
                aria-label="전체 선택"
                className="h-4 w-4 rounded border-border/60 accent-primary"
              />
            </Th>
            <Th className="w-12 bg-accent/15">{null}</Th>
```

- [ ] **Step 3: 표준 버전 / 최근 갱신일 헤더·셀을 가운데 정렬**

`SortTh`는 모든 헤더에 공용으로 쓰이므로 헤더 자체는 왼쪽 정렬을 유지하고(레이블 가독성), 데이터 셀만 가운데로 맞춘다. `sw-master-view.tsx`의 848-858번 줄(표준 버전 `Td`)을 다음으로 교체:

```tsx
                  {show("std_version") && (
                    <Td
                      className="text-center"
                      style={{ width: getColWidth("std_version"), minWidth: getColWidth("std_version"), maxWidth: getColWidth("std_version") }}
                    >
                      <EditableText
                        value={row.values.std_version}
                        onChange={(v) => draft.editCell(row.id, "std_version", v)}
                        dirty={row.dirtyFields.has("std_version")}
                        error={row.fieldErrors?.std_version}
                        required={requiredEmpty("std_version")}
                      />
                    </Td>
                  )}
```

- [ ] **Step 4: 최근 갱신일 셀 가운데 정렬 (날짜 포맷은 Task 6에서 처리)**

`sw-master-view.tsx`의 877-881번 줄(최근 갱신일 `Td` 여는 부분)을 다음으로 교체:

```tsx
                  {show("updated_at") && (
                    <Td
                      className="text-center text-xs text-muted-foreground"
                      style={{ width: getColWidth("updated_at"), minWidth: getColWidth("updated_at"), maxWidth: getColWidth("updated_at") }}
                    >
```

(이 블록의 나머지 — 날짜 표시 로직과 닫는 태그 — 는 Task 6에서 교체한다)

- [ ] **Step 5: 빌드 확인**

Run: `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 6: 수동 시각 확인**

`pnpm dev` → 표준 버전/최근 갱신일 값이 셀 가운데에 표시되는지, 선택 체크박스·더보기 메뉴 열이 이전보다 살짝 넓어졌는지 확인. 기존에 `localStorage`에 컬럼 폭을 커스텀 저장해둔 브라우저 프로필이 있다면 개발자 도구 콘솔에서 `localStorage.removeItem("sw_master_col_widths")` 후 새로고침해 기본값 반영을 확인.

- [ ] **Step 7: 커밋**

```bash
git add components/pages/sw-master-view.tsx
git commit -m "style: SW 마스터 컬럼 기본 폭 확대 및 셀 정렬 조정"
```

---

### Task 5: 제품명·벤더 툴팁 및 말줄임표

**Files:**
- Modify: `components/pages/sw-master/cells.tsx`

**Interfaces:**
- Consumes/Produces: `EditableText`, `EditableVendor`의 기존 시그니처는 변경하지 않음(props 추가 없음) — `value`를 그대로 `title`에 사용.

- [ ] **Step 1: `inputBase`에 말줄임표 스타일 추가**

`cells.tsx`의 34-35번 줄을 다음으로 교체:

```tsx
const inputBase =
  "w-full overflow-hidden truncate rounded-md border bg-transparent px-2 py-1 text-xs text-foreground focus:border-primary/60 focus:outline-none"
```

- [ ] **Step 2: `EditableText`의 `<input>`에 `title` 추가**

`cells.tsx`의 70-75번 줄을 다음으로 교체:

```tsx
      <input
        value={value}
        title={value || undefined}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? (required ? "필수" : undefined)}
        className={cn(inputBase, bold && "font-semibold", requiredBorder(value, error, required))}
      />
```

- [ ] **Step 3: `EditableVendor`의 `<input>`에 `title` 추가**

`cells.tsx`의 103-109번 줄을 다음으로 교체:

```tsx
      <input
        list={listId}
        value={value}
        title={value || undefined}
        onChange={(e) => onChange(e.target.value)}
        placeholder={required ? "필수" : "벤더 검색/입력"}
        className={cn(inputBase, requiredBorder(value, error, required))}
      />
```

- [ ] **Step 4: 빌드 확인**

Run: `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 5: 수동 시각 확인**

`pnpm dev` → SW 마스터 화면에서 제품명 컬럼 폭을 좁혀보거나(컬럼 경계 드래그) 긴 제품명("Red Hat Enterprise Linux" 등)이 잘리는 행에서 마우스를 올려 전체 텍스트가 브라우저 기본 툴팁(title)으로 뜨는지 확인. 벤더 컬럼도 동일하게 확인.

- [ ] **Step 6: 커밋**

```bash
git add components/pages/sw-master/cells.tsx
git commit -m "feat: SW 마스터 제품명·벤더 셀 말줄임표 및 툴팁 추가"
```

---

### Task 6: 최근 갱신일 24시간 포맷 통일

**Files:**
- Modify: `components/pages/sw-master/use-master-draft.ts`
- Modify: `components/pages/sw-master-view.tsx`
- Modify: `components/pages/sw-master/cells.tsx`

**Interfaces:**
- Produces: `formatDateTime(iso: string): string` — export from `use-master-draft.ts`.
- Consumes: `formatDateTime`을 `sw-master-view.tsx`와 `cells.tsx`(상세 모달)에서 import.

- [ ] **Step 1: `formatDateTime` 헬퍼 추가**

`use-master-draft.ts`의 `FIELD_LABELS` 정의(7-40번 줄 부근, 파일 상단 export 블록) 바로 다음에 추가:

```ts
export function formatDateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
```

- [ ] **Step 2: 테이블 셀에서 `formatDateTime` 사용**

`sw-master-view.tsx`의 25-31번 줄 import를 다음으로 교체(`formatDateTime` 추가):

```tsx
import {
  useMasterDraft,
  MASTER_CATEGORIES,
  COLLECT_MODES,
  formatDateTime,
  type EditableFields,
  type EffectiveRow,
} from "@/components/pages/sw-master/use-master-draft"
```

Task 4의 Step 4에서 만들어둔 최근 갱신일 `Td`의 나머지 부분(기존 882-890번 줄에 있던 날짜 표시 로직)을 다음으로 교체:

```tsx
                      {row.updatedAt ? formatDateTime(row.updatedAt) : "-"}
                    </Td>
                  )}
```

(즉 Task 4 이후 전체 블록은 아래와 같아야 한다)

```tsx
                  {show("updated_at") && (
                    <Td
                      className="text-center text-xs text-muted-foreground"
                      style={{ width: getColWidth("updated_at"), minWidth: getColWidth("updated_at"), maxWidth: getColWidth("updated_at") }}
                    >
                      {row.updatedAt ? formatDateTime(row.updatedAt) : "-"}
                    </Td>
                  )}
```

- [ ] **Step 3: 상세 모달에서 `formatDateTime` 사용**

`cells.tsx`의 import에 `formatDateTime` 추가 — 21-22번 줄을 다음으로 교체:

```tsx
import type { EditableFields, EffectiveRow } from "./use-master-draft"
import { MASTER_CATEGORIES, COLLECT_MODES, FIELD_LABELS, formatDateTime } from "./use-master-draft"
```

`cells.tsx`의 370번 줄을 다음으로 교체:

```tsx
    { label: "최근 갱신일", value: row.updatedAt ? formatDateTime(row.updatedAt) : "-" },
```

- [ ] **Step 4: 빌드 확인**

Run: `pnpm lint`
Expected: 에러 없음.

- [ ] **Step 5: 수동 시각 확인**

`pnpm dev` → SW 마스터 테이블의 최근 갱신일 컬럼과, 임의 행 더보기 → "상세 보기" 모달의 최근 갱신일 값이 모두 `2026.07.12 02:13` 형식(오전/오후 없음, 24시간제)으로 표시되는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add components/pages/sw-master/use-master-draft.ts components/pages/sw-master-view.tsx components/pages/sw-master/cells.tsx
git commit -m "feat: SW 마스터 최근 갱신일 24시간 포맷으로 통일"
```

---

## Self-Review Notes

- **스펙 커버리지:** 원본 요청 1~10번 항목 모두 태스크에 매핑됨 — 배지(Task 1,2), 조회/편집 분리(Task 2), 일괄수정(Task 3), 컬럼폭/정렬(Task 4), 툴팁(Task 5), 날짜(Task 6), 데이터/표시 분리(변경 없음 — 기존에 이미 순수 문자열 export, Task 1~3에서 유지 확인).
- **타입 일관성:** `RowMenu`의 새 prop(`editing`, `onToggleEdit`)은 Task 2에서 정의와 호출부를 같은 태스크 안에서 함께 바꿔 빌드 깨짐 없음. `formatDateTime` export 이름은 Task 6 전체에서 동일하게 사용.
- **범위 제외 확인:** 등록일(`created_at`)/수정자 컬럼 포맷은 요청 범위 밖이라 변경하지 않음. Excel 컬럼 정의(`ExportExcelButton`의 `columns`)는 이미 순수 값 참조라 변경 불필요.
