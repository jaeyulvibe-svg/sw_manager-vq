# 공지사항 NO 컬럼 + 제목 클릭 상세/편집 패널 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `components/pages/notice-board-view.tsx`(공지사항 목록)의 `구분`/`관리` 컬럼을 없애고 `NO` 순번 컬럼을 추가하며, 제목 클릭으로 열리는 통합 상세/편집 패널(보기·수정·삭제)로 개편한다.

**Architecture:** 기존에 이 파일에 따로 있던 `expandedId`(상세 펼침)와 `panel`(행이 폼으로 바뀌는 인라인 수정)을 `openId`/`editMode`/`draft` 3개 상태로 합치고, 그 렌더링을 새 서브컴포넌트 `NoticeDetailPanel`로 뽑아낸다. 순번(`NO`)은 검색 필터링된 집합을 작성일 오름차순으로 미리 랭크 매핑해두고, 화면에는 사용자가 고른 정렬/페이지 순서로 행을 그리되 그 랭크 맵에서 번호만 조회해 붙인다. 미저장 변경사항 보호는 이미 `app/page.tsx`에서 뷰 전환용으로만 쓰이던 `components/portal/unsaved-guard.tsx`의 `useUnsavedGuard()`를 이 화면 내부 상태 전환에도 재사용한다.

**Tech Stack:** Next.js(App Router, client component), React, TypeScript, Tailwind, lucide-react, Supabase JS client.

## Global Constraints

- 이 프로젝트에는 자동화 테스트가 없다(`CLAUDE.md`: "No test suite is configured"). 각 태스크의 "테스트" 단계는 `pnpm build`(또는 `pnpm`이 없으면 `npm run build`)와 `pnpm dev` 기반 브라우저 수동 확인으로 대체한다. `next.config.mjs`가 `typescript.ignoreBuildErrors: true`라 타입 오류는 빌드로 안 걸러지므로 브라우저 수동 확인이 더 중요하다.
- 패키지 매니저는 `pnpm`이 표준이지만 셸에 없을 수 있다 — 없으면 `npm run build`/`npm run dev`/`npm run lint`로 동일하게 실행한다.
- `notices` 테이블 스키마는 변경하지 않는다. `category` 컬럼은 DB에 그대로 남기고 화면에서만 뺀다.
- `등록일` 라벨은 그대로 유지한다(스펙 문서 예시엔 "작성일"로 적혀 있지만, 이 화면과 대시보드 위젯(`components/dashboard/notice-boards.tsx`)이 이미 일관되게 "등록일"을 쓰고 있어 불필요한 표기 흔들림을 피한다).
- "추가" 버튼으로 여는 신규 등록 폼(`NoticeFormPanel`, `panel === "add"`)은 이번 작업 범위 밖 — `구분` 선택 필드 포함해서 그대로 둔다(`notices.category`가 NOT NULL이라 필요).
- `components/dashboard/notice-boards.tsx`(대시보드 위젯)는 이번 계획에서 건드리지 않는다.
- 검색/정렬/페이지네이션/다중선택 일괄삭제 로직의 내부 동작 방식은 바꾸지 않는다 — 컬럼 구성과 행/패널 렌더링만 바꾼다.
- 커밋은 태스크 단위로 나눠서 한다.

---

### Task 1: NO 컬럼 추가 + 구분(category) 컬럼 제거

**Files:**
- Modify: `components/pages/notice-board-view.tsx`

**Interfaces:**
- Produces: 컴포넌트 내부 지역 변수 `noRank: Map<string, number>` — 검색 필터링된 공지 집합을 작성일 오름차순으로 매긴 고정 순번 맵. Task 2~5에서도 계속 이 이름으로 참조한다.

- [ ] **Step 1: `categoryAccent` 상수와 `구분` 컬럼 정의 제거**

`components/pages/notice-board-view.tsx`에서 다음 상수 블록(파일 45~50번째 줄 부근)을 통째로 삭제한다:

```tsx
const categoryAccent: Record<string, Accent> = {
  시스템: "primary",
  운영: "success",
  승인: "eos",
  보고서: "muted",
}
```

`NOTICE_ALL_COLS`/`NOTICE_FACTORY_VISIBLE` 정의(162~170번째 줄 부근)를 다음으로 교체한다(`"category"`를 `NoticeColKey`와 목록에서 제거):

```tsx
type NoticeColKey = "title" | "author" | "created_at" | "views" | "status"
const NOTICE_ALL_COLS: { key: NoticeColKey; label: string }[] = [
  { key: "title", label: "제목" },
  { key: "author", label: "작성자" },
  { key: "created_at", label: "등록일" },
  { key: "views", label: "조회수" },
  { key: "status", label: "상태" },
]
const NOTICE_FACTORY_VISIBLE: NoticeColKey[] = NOTICE_ALL_COLS.map((c) => c.key)
const NOTICE_LS_KEY = "notice_board_columns"
```

(참고: `noticeSortValue`, `noticeStatusOrder`, `NoticeSortKey` 정의는 `NoticeColKey`를 그대로 참조하므로 수정할 필요 없다 — `NoticeColKey`에서 `"category"`가 빠지면 자동으로 함께 좁혀진다.)

- [ ] **Step 2: 검색 로직을 필터(searched)와 정렬(filtered) 두 단계로 분리하고 `noRank` 계산 추가**

기존 `const filtered = notices.filter(...).sort(...)` 블록(222~232번째 줄 부근)을 다음으로 교체한다:

```tsx
const searched = notices.filter((n) => {
  const q = query.trim().toLowerCase()
  return !q || [n.title, n.author].some((f) => f.toLowerCase().includes(q))
})

const noRank = new Map<string, number>()
;[...searched]
  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  .forEach((n, i) => noRank.set(n.id, i + 1))

const filtered = [...searched].sort((a, b) => {
  const va = noticeSortValue(a, sortKey)
  const vb = noticeSortValue(b, sortKey)
  const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
  return sortDir === "asc" ? d : -d
})
```

- [ ] **Step 3: 검색 placeholder에서 "구분" 문구 제거**

`placeholder="제목, 작성자, 구분 검색"`(325번째 줄 부근)을 `placeholder="제목, 작성자 검색"`으로 바꾼다.

- [ ] **Step 4: 엑셀 내보내기 컬럼에서 `구분` 제거하고 `NO` 추가**

`ExportExcelButton`의 `columns` 배열(332~339번째 줄 부근)을 다음으로 교체한다:

```tsx
columns={[
  { label: "NO", value: (n: Notice) => noRank.get(n.id) ?? "" },
  { label: "제목", value: (n: Notice) => n.title },
  { label: "작성자", value: (n: Notice) => n.author },
  { label: "등록일", value: (n: Notice) => new Date(n.created_at).toLocaleDateString("ko-KR") },
  { label: "조회수", value: (n: Notice) => n.views },
  { label: "상태", value: (n: Notice) => n.status },
]}
```

- [ ] **Step 5: `colSpan` 계산에 NO 컬럼 반영**

`const colSpan = visible.length + 1 + (isAdmin ? 1 : 0)`(299번째 줄 부근)를 다음으로 바꾼다:

```tsx
// +1 은 NO 컬럼, +1 은 관리 컬럼(Task 2에서 제목 컬럼으로 대체되지만 개수는 그대로 +2 유지)
const colSpan = visible.length + 2 + (isAdmin ? 1 : 0)
```

- [ ] **Step 6: 테이블 헤더에 NO 추가, 구분 Th 제거**

헤더 `<tr>`(368~387번째 줄 부근)에서 다음 줄을 삭제한다:

```tsx
{show("category") && <SortTh col="category" label="구분" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
```

그리고 체크박스 `<Th>` 바로 다음, 제목 `<SortTh col="title" .../>` 바로 앞에 아래를 추가한다:

```tsx
<Th className={cn("w-12", TABLE_HEADER_CELL_H)}>NO</Th>
```

- [ ] **Step 7: 행에 NO 셀 추가, 구분 셀 제거**

각 행 렌더링(429~433번째 줄 부근)에서 다음 블록을 삭제한다:

```tsx
{show("category") && (
  <Td className={TABLE_ROW_CELL_H}>
    <StatusBadge accent={categoryAccent[n.category] ?? "muted"}>{n.category}</StatusBadge>
  </Td>
)}
```

체크박스 `<Td>` 바로 다음, 제목 `<Td>` 바로 앞에 아래를 추가한다:

```tsx
<Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>
  {noRank.get(n.id) ?? "-"}
</Td>
```

- [ ] **Step 8: 빌드 확인**

Run: `pnpm build` (또는 `npm run build`)
Expected: 컴파일 에러 없이 성공. (`categoryAccent`/`"category"` 관련 미사용 변수 경고가 남아있지 않은지 확인 — 남아있다면 Step 1에서 지운 게 맞는지 재확인)

- [ ] **Step 9: 브라우저 수동 확인**

Run: `pnpm dev` → `http://localhost:3000` → 사이드바에서 "공지사항" 진입.
Expected:
- 테이블 맨 앞(체크박스 다음)에 `NO` 컬럼이 보이고, 최신 공지가 가장 큰 번호를 가진다.
- `구분` 컬럼과 배지가 목록에서 사라졌다.
- 제목/작성자로 검색했을 때 결과 집합 기준으로 번호가 다시 매겨진다(예: 검색 결과가 3건이면 1~3).
- 정렬 컬럼을 바꿔도(예: 작성자 클릭) 각 행의 NO 번호는 그대로다.
- 페이지를 2페이지로 넘겨도 번호가 1부터 다시 시작하지 않는다.
- 기존 "상세"/"수정"/관리 컬럼 동작은 이번 태스크에서 아직 그대로 살아있다(Task 2에서 교체 예정).

- [ ] **Step 10: 커밋**

```bash
git add components/pages/notice-board-view.tsx
git commit -m "feat: add NO rank column to notice board list, drop 구분 column from view"
```

---

### Task 2: 제목 클릭 통합 패널(보기/수정) — 관리 컬럼 및 기존 expandedId/panel 로직 교체

**Files:**
- Modify: `components/pages/notice-board-view.tsx`

**Interfaces:**
- Consumes: Task 1의 `noRank: Map<string, number>`, `colSpan` 계산식.
- Produces:
  - `type NoticeDraft = { title: string; content: string; status: NoticeStatus }`
  - `function NoticeDetailPanel(props: { notice: Notice; isAdmin: boolean; editMode: boolean; draft: NoticeDraft | null; saving: boolean; onDraftChange: (next: NoticeDraft) => void; onStartEdit: () => void; onCancelEdit: () => void; onSave: () => void; onClose: () => void }): JSX.Element` — Task 3에서 `onDeleteRequest: () => void` prop이 추가된다.
  - `NoticeBoardView` 내부 상태: `openId: string | null`, `editMode: boolean`, `draft: NoticeDraft | null`, `saving: boolean`
  - `NoticeBoardView` 내부 함수: `handleTitleClick(id: string)`, `handleStartEdit(n: Notice)`, `handleDraftChange(next: NoticeDraft, original: Notice)`, `handleCancelEdit()`, `handleSave()`, `handleClosePanel()`

- [ ] **Step 1: import 정리**

파일 상단 import 블록(3~11번째 줄)을 다음으로 교체한다:

```tsx
"use client"

import { Fragment, useEffect, useState } from "react"
import {
  Megaphone,
  Search,
  Plus,
  Pencil,
  Save,
  Check,
} from "lucide-react"
```

(`ChevronDown`, `ChevronUp`은 더 이상 쓰이지 않으므로 제거한다. `Trash2`는 Task 3에서 추가한다.)

- [ ] **Step 2: `NoticeDraft` 타입과 `NoticeDetailPanel` 컴포넌트 추가**

`NoticeFormPanel` 함수 정의가 끝나는 지점(158번째 줄, `}` 바로 뒤) 바로 아래에 다음을 통째로 추가한다:

```tsx
/* ---- 제목 클릭 시 열리는 상세/편집 패널 ---- */
type NoticeDraft = { title: string; content: string; status: NoticeStatus }

function NoticeDetailPanel({
  notice,
  isAdmin,
  editMode,
  draft,
  saving,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onClose,
}: {
  notice: Notice
  isAdmin: boolean
  editMode: boolean
  draft: NoticeDraft | null
  saving: boolean
  onDraftChange: (next: NoticeDraft) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onClose: () => void
}) {
  const view: NoticeDraft =
    editMode && draft ? draft : { title: notice.title, content: notice.content, status: notice.status }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">제목</span>
        {editMode ? (
          <input
            value={view.title}
            onChange={(e) => onDraftChange({ ...view, title: e.target.value })}
            className={inputCls}
          />
        ) : (
          <p className="text-sm font-semibold text-foreground">{view.title}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>작성자 {notice.author}</span>
        <span>작성일 {new Date(notice.created_at).toLocaleDateString("ko-KR")}</span>
      </div>

      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">상태</span>
        {editMode ? (
          <select
            value={view.status}
            onChange={(e) => onDraftChange({ ...view, status: e.target.value as NoticeStatus })}
            className={cn(inputCls, "w-32")}
          >
            {NOTICE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        ) : (
          <StatusBadge risk={statusRisk[view.status]} pulse={view.status === "긴급"}>
            {view.status}
          </StatusBadge>
        )}
      </div>

      <div className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-muted-foreground">공지 내용</span>
        {editMode ? (
          <textarea
            value={view.content}
            onChange={(e) => onDraftChange({ ...view, content: e.target.value })}
            rows={6}
            className={cn(inputCls, "resize-y")}
          />
        ) : (
          <p className="whitespace-pre-wrap text-xs text-foreground/90">
            {view.content || "등록된 본문 내용이 없습니다."}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {editMode ? (
          <>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !view.title.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-3 w-3" />
              저장
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              취소
            </button>
          </>
        ) : (
          <>
            {isAdmin ? (
              <button
                type="button"
                onClick={onStartEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40"
              >
                <Pencil className="h-3 w-3" />
                수정
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Check className="h-3 w-3" />
              확인
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `NoticeBoardView` 상태를 `openId`/`editMode`/`draft`/`saving`으로 교체**

기존 상태 선언(193~196번째 줄 부근):

```tsx
const [panel, setPanel] = useState<"add" | string | null>(null)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
const [expandedId, setExpandedId] = useState<string | null>(null)
const [deleteRequest, setDeleteRequest] = useState<{ ids: string[]; title: string; confirmLabel: string } | null>(null)
```

을 다음으로 교체한다:

```tsx
const [panel, setPanel] = useState<"add" | null>(null)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
const [deleteRequest, setDeleteRequest] = useState<{ ids: string[]; title: string; confirmLabel: string } | null>(null)

const [openId, setOpenId] = useState<string | null>(null)
const [editMode, setEditMode] = useState(false)
const [draft, setDraft] = useState<NoticeDraft | null>(null)
const [saving, setSaving] = useState(false)
```

`saveNotice` 함수(237~257번째 줄 부근)는 `panel === "add"`와 `panel`(id) 두 분기를 갖고 있었는데, 이제 `panel`은 `"add" | null`만 가능하므로 `else if (panel)` 분기(수정용)를 삭제하고 다음으로 교체한다:

```tsx
async function saveNotice(values: NoticeFormValues) {
  const supabase = createClient()
  const payload: TablesInsert<"notices"> = { ...values }
  const { error } = await supabase.from("notices").insert(payload)
  if (error) {
    toast({ title: "공지 등록 실패", description: error.message, tone: "danger" })
    return
  }
  toast({ title: "공지사항이 등록되었습니다", tone: "success" })
  setPanel(null)
  loadNotices()
}
```

- [ ] **Step 4: 패널 상태 전환 핸들러 추가**

`saveNotice` 함수 바로 뒤에 다음 함수들을 추가한다:

```tsx
function handleTitleClick(id: string) {
  if (openId === id) {
    setOpenId(null)
  } else {
    setOpenId(id)
  }
  setEditMode(false)
  setDraft(null)
}

function handleStartEdit(n: Notice) {
  setDraft({ title: n.title, content: n.content, status: n.status })
  setEditMode(true)
}

function handleDraftChange(next: NoticeDraft) {
  setDraft(next)
}

function handleCancelEdit() {
  setEditMode(false)
  setDraft(null)
}

async function handleSave() {
  if (!draft || !openId) return
  if (!draft.title.trim()) {
    toast({ title: "제목을 입력해주세요", tone: "danger" })
    return
  }
  setSaving(true)
  const supabase = createClient()
  const { error } = await supabase
    .from("notices")
    .update({ title: draft.title, content: draft.content, status: draft.status })
    .eq("id", openId)
  setSaving(false)
  if (error) {
    toast({ title: "공지 수정 실패", description: error.message, tone: "danger" })
    return
  }
  toast({ title: "공지사항이 수정되었습니다", tone: "success" })
  setEditMode(false)
  setDraft(null)
  loadNotices()
}

function handleClosePanel() {
  setOpenId(null)
  setEditMode(false)
  setDraft(null)
}
```

(미저장 변경사항 확인은 Task 4에서 `handleTitleClick`/`handleClosePanel`에 추가한다 — 이 태스크에서는 아직 무조건 닫힌다.)

- [ ] **Step 5: 테이블 헤더에서 관리 Th 제거, 제목을 항상 노출되는 정렬 가능 컬럼으로 전환**

헤더 `<tr>`(Task 1 이후 기준)에서:

```tsx
{show("title") && <SortTh col="title" label="제목" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
```

를

```tsx
<SortTh col="title" label="제목" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
```

로 바꾼다(`show("title")` 가드 제거 — 제목은 이제 패널을 여는 트리거라 항상 보여야 한다). 그리고 헤더 맨 끝의

```tsx
<Th className={TABLE_HEADER_CELL_H}>관리</Th>
```

줄을 삭제한다.

`NOTICE_ALL_COLS`/`NOTICE_FACTORY_VISIBLE`(Task 1에서 정의한 것)에서 `title` 항목을 제거해 컬럼 설정 메뉴에서 숨김 토글이 불가능하게 만든다:

```tsx
type NoticeColKey = "title" | "author" | "created_at" | "views" | "status"
type ToggleableColKey = Exclude<NoticeColKey, "title">
const NOTICE_ALL_COLS: { key: ToggleableColKey; label: string }[] = [
  { key: "author", label: "작성자" },
  { key: "created_at", label: "등록일" },
  { key: "views", label: "조회수" },
  { key: "status", label: "상태" },
]
const NOTICE_FACTORY_VISIBLE: ToggleableColKey[] = NOTICE_ALL_COLS.map((c) => c.key)
```

`const [visible, setVisible] = useState<NoticeColKey[]>(...)`을 `useState<ToggleableColKey[]>(...)`로, `const show = (key: NoticeColKey) => ...`를 `const show = (key: ToggleableColKey) => ...`로 바꾼다. `ColumnVisibilityMenu`/`loadColumnVisibility` 호출부의 제네릭은 타입 추론으로 자동 해결되므로 별도 수정은 필요 없다.

- [ ] **Step 6: 행 렌더링을 통째로 교체**

기존의 `panel === n.id` 분기(인라인 수정 폼)와 `expandedId` 기반 펼침 로직을 포함한 `pagination.pageItems.map(...)` 블록 전체(397~479번째 줄 부근, Task 1 이후로는 줄 번호가 약간 달라져 있음 — `{pagination.pageItems.map((n) => {`부터 그 블록이 끝나는 `})}`까지)를 다음으로 교체한다:

```tsx
{pagination.pageItems.map((n) => {
  const isOpen = openId === n.id
  return (
    <Fragment key={n.id}>
      <tr className="transition-colors hover:bg-accent/40">
        {isAdmin ? (
          <Td className={TABLE_ROW_CELL_H}>
            <input
              type="checkbox"
              checked={selectedIds.has(n.id)}
              onChange={() => toggleSelected(n.id)}
              aria-label={`${n.title} 선택`}
              className="h-4 w-4 rounded border-border/60 accent-primary"
            />
          </Td>
        ) : null}
        <Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>
          {noRank.get(n.id) ?? "-"}
        </Td>
        <Td className={cn("max-w-xs", TABLE_ROW_CELL_H)}>
          <button
            type="button"
            onClick={() => handleTitleClick(n.id)}
            aria-expanded={isOpen}
            aria-controls={`notice-panel-${n.id}`}
            className="line-clamp-2 whitespace-normal text-left font-medium text-foreground underline-offset-2 hover:text-primary hover:underline focus:underline focus:outline-none"
          >
            {n.title}
          </button>
        </Td>
        {show("author") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{n.author}</Td>}
        {show("created_at") && (
          <Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>
            {new Date(n.created_at).toLocaleDateString("ko-KR")}
          </Td>
        )}
        {show("views") && (
          <Td className={cn("text-right font-mono tabular-nums text-muted-foreground", TABLE_ROW_CELL_H)}>
            {n.views.toLocaleString()}
          </Td>
        )}
        {show("status") && (
          <Td className={TABLE_ROW_CELL_H}>
            <StatusBadge risk={statusRisk[n.status]} pulse={n.status === "긴급"}>
              {n.status}
            </StatusBadge>
          </Td>
        )}
      </tr>
      {isOpen ? (
        <tr id={`notice-panel-${n.id}`}>
          <td colSpan={colSpan} className="border-b border-border/40 bg-background/40 p-3">
            <NoticeDetailPanel
              notice={n}
              isAdmin={isAdmin}
              editMode={editMode}
              draft={draft}
              saving={saving}
              onDraftChange={handleDraftChange}
              onStartEdit={() => handleStartEdit(n)}
              onCancelEdit={handleCancelEdit}
              onSave={handleSave}
              onClose={handleClosePanel}
            />
          </td>
        </tr>
      ) : null}
    </Fragment>
  )
})}
```

- [ ] **Step 7: 빌드 확인**

Run: `pnpm build`
Expected: 성공. `panel`을 id로 쓰던 잔여 참조나 `expandedId` 참조가 남아있으면 타입 에러 없이도 ESLint 경고가 뜰 수 있으니 `pnpm lint`도 함께 돌려 미사용 변수 경고가 없는지 확인한다.

- [ ] **Step 8: 브라우저 수동 확인**

Run: `pnpm dev` → 공지사항 화면.
Expected:
- `관리` 컬럼이 사라졌다.
- 제목에 마우스를 올리면 밑줄/포인터가 보이고, 클릭하면 행 아래에 패널이 펼쳐진다. 같은 제목을 다시 클릭하면 닫힌다. 다른 제목을 클릭하면 이전 패널이 닫히고 새 패널이 열린다.
- 관리자: 패널에 `[수정] [확인]` 버튼이 보인다. `수정` 클릭 → 제목/본문/상태 입력 가능 상태로 바뀌고 버튼이 `[저장] [취소]`로 바뀐다. 값 바꾸고 저장 → 토스트 성공 메시지, 목록의 작성일/상태/제목이 갱신된다. `취소` → 원래 값으로 돌아간다.
- 일반 사용자: `UserSwitcher`로 담당자/조회 사용자 등 비관리자 계정으로 전환 후 확인 — 패널에 `[확인]` 버튼만 보이고 입력란은 읽기전용이다.
- Chrome 개발자도구로 모바일 폭(375px)에서도 패널 버튼 줄이 잘리지 않고 줄바꿈된다.

- [ ] **Step 9: 커밋**

```bash
git add components/pages/notice-board-view.tsx
git commit -m "feat: replace notice board 관리 column with title-click view/edit panel"
```

---

### Task 3: 삭제 버튼 연결 (기존 ConfirmDialog 재사용)

**Files:**
- Modify: `components/pages/notice-board-view.tsx`

**Interfaces:**
- Consumes: Task 2의 `NoticeDetailPanel`, `deleteRequest`/`confirmDelete` 상태(이 파일에 이미 있던 일괄삭제용 로직).
- Produces: `NoticeDetailPanel`에 `onDeleteRequest: () => void` prop 추가.

- [ ] **Step 1: import에 `Trash2` 추가**

Task 2에서 정리한 lucide-react import에 `Trash2`를 추가한다:

```tsx
import {
  Megaphone,
  Search,
  Plus,
  Pencil,
  Save,
  Check,
  Trash2,
} from "lucide-react"
```

- [ ] **Step 2: `NoticeDetailPanel`에 삭제 버튼 추가**

`NoticeDetailPanel`의 props 타입에 `onDeleteRequest: () => void`를 추가하고, 함수 인자 구조분해에도 추가한다:

```tsx
function NoticeDetailPanel({
  notice,
  isAdmin,
  editMode,
  draft,
  saving,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onClose,
  onDeleteRequest,
}: {
  notice: Notice
  isAdmin: boolean
  editMode: boolean
  draft: NoticeDraft | null
  saving: boolean
  onDraftChange: (next: NoticeDraft) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onClose: () => void
  onDeleteRequest: () => void
}) {
```

보기 모드 버튼 그룹(`editMode`가 `false`일 때 렌더되는 `<>...</>`) 안, `확인` 버튼 뒤에 삭제 버튼을 추가한다:

```tsx
<>
  {isAdmin ? (
    <button
      type="button"
      onClick={onStartEdit}
      className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40"
    >
      <Pencil className="h-3 w-3" />
      수정
    </button>
  ) : null}
  <button
    type="button"
    onClick={onClose}
    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
  >
    <Check className="h-3 w-3" />
    확인
  </button>
  {isAdmin ? (
    <button
      type="button"
      onClick={onDeleteRequest}
      className="ml-auto inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
    >
      <Trash2 className="h-3 w-3" />
      삭제
    </button>
  ) : null}
</>
```

- [ ] **Step 3: `NoticeBoardView`에 단건 삭제 요청 핸들러 추가, `confirmDelete`가 열린 패널을 정리하도록 수정**

기존 `requestDeleteSelected`(259~266번째 줄 부근) 바로 위에 다음 함수를 추가한다:

```tsx
function requestDeleteNotice(n: Notice) {
  setDeleteRequest({
    ids: [n.id],
    title: `"${n.title}"을(를) 삭제할까요?`,
    confirmLabel: "삭제",
  })
}
```

기존 `confirmDelete` 함수(267~280번째 줄 부근)를 다음으로 교체해, 삭제된 공지가 현재 열려 있던 패널이면 패널도 함께 닫는다:

```tsx
async function confirmDelete() {
  if (!deleteRequest) return
  const supabase = createClient()
  const { error } = await supabase.from("notices").delete().in("id", deleteRequest.ids)
  if (error) {
    toast({ title: "삭제 실패", description: error.message, tone: "danger" })
    setDeleteRequest(null)
    return
  }
  toast({ title: `공지 ${deleteRequest.ids.length}건이 삭제되었습니다`, tone: "info" })
  if (openId && deleteRequest.ids.includes(openId)) {
    setOpenId(null)
    setEditMode(false)
    setDraft(null)
  }
  setSelectedIds(new Set())
  setDeleteRequest(null)
  loadNotices()
}
```

- [ ] **Step 4: `NoticeDetailPanel` 사용부에 `onDeleteRequest` 전달**

Task 2에서 작성한 `<NoticeDetailPanel ... onClose={handleClosePanel} />` 호출에 다음 prop을 추가한다:

```tsx
onDeleteRequest={() => requestDeleteNotice(n)}
```

- [ ] **Step 5: 빌드 확인**

Run: `pnpm build`
Expected: 성공, 타입 에러 없음.

- [ ] **Step 6: 브라우저 수동 확인**

Run: `pnpm dev` → 관리자 계정으로 공지사항 → 아무 제목 클릭 → 패널의 `삭제` 버튼 클릭.
Expected: 기존에 있던 `ConfirmDialog`가 뜨고 문구에 해당 공지 제목이 포함된다. 확인을 누르면 목록에서 사라지고 패널도 닫힌다. 취소를 누르면 아무 변화 없다. 일반 사용자 계정에서는 삭제 버튼 자체가 보이지 않는다.

- [ ] **Step 7: 커밋**

```bash
git add components/pages/notice-board-view.tsx
git commit -m "feat: wire notice delete button into the detail panel via existing ConfirmDialog"
```

---

### Task 4: 미저장 변경사항 가드 연결 (`useUnsavedGuard` 재사용)

**Files:**
- Modify: `components/pages/notice-board-view.tsx`

**Interfaces:**
- Consumes: `components/portal/unsaved-guard.tsx`의 `useUnsavedGuard(): { setDirty: (dirty: boolean) => void; confirmLeave: () => boolean }` (기존 훅, 지금까지는 `app/page.tsx`의 뷰 전환에만 쓰였다).

- [ ] **Step 1: import 추가 및 훅 사용**

파일 상단 import 블록에 다음을 추가한다:

```tsx
import { useUnsavedGuard } from "@/components/portal/unsaved-guard"
```

`NoticeBoardView` 함수 본문 맨 위, `const { isAdmin } = useRole()` 바로 아래에 추가한다:

```tsx
const { setDirty, confirmLeave } = useUnsavedGuard()
```

- [ ] **Step 2: 편집 상태 변경 지점마다 `setDirty` 동기화**

Task 2에서 작성한 아래 4개 함수를 다음과 같이 수정한다 (dirty 여부는 draft와 원본 notice를 비교해 판단한다):

```tsx
function handleStartEdit(n: Notice) {
  setDraft({ title: n.title, content: n.content, status: n.status })
  setEditMode(true)
  setDirty(false)
}

function handleDraftChange(next: NoticeDraft, original: Notice) {
  setDraft(next)
  setDirty(
    next.title !== original.title ||
      next.content !== original.content ||
      next.status !== original.status,
  )
}

function handleCancelEdit() {
  setEditMode(false)
  setDraft(null)
  setDirty(false)
}
```

`handleSave` 함수의 성공 분기(`toast({ title: "공지사항이 수정되었습니다", ... })` 다음 줄)에 `setDirty(false)`를 추가한다:

```tsx
  toast({ title: "공지사항이 수정되었습니다", tone: "success" })
  setEditMode(false)
  setDraft(null)
  setDirty(false)
  loadNotices()
}
```

`NoticeDetailPanel` 사용부의 `onDraftChange={handleDraftChange}`를 `onDraftChange={(next) => handleDraftChange(next, n)}`로 바꾼다(원본 `notice`와 비교해야 하므로 클로저로 `n`을 넘긴다).

- [ ] **Step 3: 패널 전환/닫기에 가드 적용**

`handleTitleClick`과 `handleClosePanel`을 다음으로 교체한다:

```tsx
function handleTitleClick(id: string) {
  if (editMode && !confirmLeave()) return
  setOpenId((prev) => (prev === id ? null : id))
  setEditMode(false)
  setDraft(null)
  setDirty(false)
}

function handleClosePanel() {
  if (editMode && !confirmLeave()) return
  setOpenId(null)
  setEditMode(false)
  setDraft(null)
  setDirty(false)
}
```

- [ ] **Step 4: 빌드 확인**

Run: `pnpm build`
Expected: 성공.

- [ ] **Step 5: 브라우저 수동 확인**

Run: `pnpm dev` → 관리자 계정으로 공지사항 → 제목 클릭 → 수정 → 제목이나 본문을 바꾼 채로:
1. `확인` 버튼 클릭 → `window.confirm`("저장하지 않은 변경사항이 있습니다...")이 뜬다. 취소를 누르면 편집 상태가 유지된다. 확인을 누르면 패널이 닫히고 변경사항은 버려진다.
2. 다른 공지 제목을 클릭 → 같은 confirm이 뜬다. 취소하면 원래 편집 중이던 패널이 그대로 유지된다. 확인하면 이전 패널이 닫히고 새 패널이 열린다.
3. 변경사항 없이(수정 모드 진입만 하고 아무것도 안 바꾼 채로) `확인`을 누르면 confirm 없이 바로 닫힌다.
4. 브라우저 탭을 닫으려 하면(또는 새로고침) 기존 `beforeunload` 경고가 그대로 동작하는지 확인한다(이 훅이 전역으로 이미 처리 중이던 기능 — 회귀 없는지 확인용).

- [ ] **Step 6: 커밋**

```bash
git add components/pages/notice-board-view.tsx
git commit -m "feat: guard unsaved notice edits on panel close/switch via useUnsavedGuard"
```

---

### Task 5: 최종 회귀 확인

**Files:**
- 없음(코드 변경 없음, 검증만)

- [ ] **Step 1: `pnpm lint` 실행**

Run: `pnpm lint` (또는 `npm run lint`)
Expected: `components/pages/notice-board-view.tsx` 관련 에러 없음.

- [ ] **Step 2: `pnpm build` 실행**

Run: `pnpm build` (또는 `npm run build`)
Expected: 빌드 성공.

- [ ] **Step 3: 관리자 시나리오 전체 확인**

Run: `pnpm dev` → 관리자 계정으로 공지사항 진입.
Expected 항목 모두 통과:
- 검색: 제목/작성자로 검색되고, NO가 검색 결과 기준으로 재계산된다.
- 정렬: 작성자/등록일/조회수/상태 헤더 클릭 정렬이 동작하고 NO는 안 바뀐다.
- 페이지 이동: 페이지 크기/페이지 변경 후에도 NO가 유지된다.
- 다중 선택: 체크박스로 여러 개 선택 → `SelectionActionBar` 뜸 → 일괄삭제 정상 동작.
- 엑셀 내보내기: 다운로드한 파일에 `NO` 컬럼이 있고 `구분` 컬럼은 없다.
- "추가" 버튼으로 신규 공지 등록(구분 선택 포함) 정상 동작.
- 제목 클릭 → 상세 → 수정 → 저장/취소 → 삭제 전부 정상.

- [ ] **Step 4: 일반 사용자 시나리오 확인**

헤더의 `UserSwitcher`로 담당자 또는 조회 사용자로 전환 → 공지사항 진입.
Expected:
- 체크박스 컬럼, "추가" 버튼이 안 보인다(기존 동작 유지).
- 제목 클릭 시 패널이 열리고 `확인` 버튼만 보이며 모든 입력란이 읽기전용이다.
- `수정`/`삭제` 버튼이 전혀 보이지 않는다.

- [ ] **Step 5: 모바일 폭 확인**

Chrome 개발자도구 반응형 모드, 375px 폭으로 공지사항 화면 확인.
Expected: 테이블은 `TableShell`의 가로 스크롤 힌트로 스크롤되고, 펼쳐진 패널의 텍스트와 버튼 줄은 잘리지 않고 줄바꿈된다.

- [ ] **Step 6: 다른 화면 회귀 확인**

대시보드(`components/dashboard/notice-boards.tsx`가 쓰이는 화면)에서 공지사항 위젯이 여전히 정상 표시되는지 확인(이번 계획에서 건드리지 않았으므로 회귀가 없어야 정상).
