# 공용 테이블 컨벤션 적용 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SW 마스터 관리 화면의 테이블 UX 컨벤션(정렬, 컬럼 표시/숨김, 헤더·행 높이, 가로 스크롤 힌트)을 자산 목록, 패치&취약점 모니터링, 관리자 페이지의 공식 Source URL 관리·사용자 권한 관리 4개 화면에 통일 적용한다.

**Architecture:** `components/portal/ui.tsx`에 공용 `SortTh`, `ColumnVisibilityMenu`, `loadColumnVisibility`, 높이 상수를 새로 추가하고, 4개 페이지 컴포넌트가 각자 갖고 있던(혹은 없던) 정렬/컬럼토글 로직을 이 공용 컴포넌트 사용으로 교체한다. SW 마스터 화면 자체와 DB 스키마는 변경하지 않는다.

**Tech Stack:** Next.js (App Router, single-page client component), React, TypeScript, Tailwind, lucide-react 아이콘, Supabase JS client.

## Global Constraints

- 이 프로젝트에는 자동화 테스트가 없다(`CLAUDE.md`: "No test suite is configured"). 각 태스크의 "테스트" 단계는 `npm run build`(컴파일/모듈 해석 오류 확인 — `next.config.mjs`가 `typescript.ignoreBuildErrors: true`라 타입 오류는 안 걸러지므로 브라우저 수동 확인이 더 중요)와 `npm run dev` 기반 수동 확인으로 대체한다.
- 패키지 매니저는 `pnpm`이 표준이지만 이 환경 셸에는 없을 수 있다 — `pnpm`이 없으면 `npm`으로 동일 스크립트를 실행한다(`npm run build`, `npm run dev`, `npm run lint`).
- 커밋은 태스크 단위로 나눠서 한다. 각 태스크 끝에 커밋.
- SW 마스터 관리 화면(`components/pages/sw-master-view.tsx`)은 이번 계획에서 수정하지 않는다.
- DB 스키마, Supabase 마이그레이션은 이번 계획에서 변경하지 않는다.
- 컬럼 폭 드래그 조절, Shift 다중정렬, 페이지네이션은 이번 범위에 포함하지 않는다.

---

### Task 1: `components/portal/ui.tsx`에 공용 테이블 컴포넌트 추가

**Files:**
- Modify: `components/portal/ui.tsx`

**Interfaces:**
- Produces:
  - `TABLE_HEADER_CELL_H: string` — 헤더 셀 클래스(`"h-[52px] py-0"`)
  - `TABLE_ROW_CELL_H: string` — 행 셀 클래스(`"h-16 py-0"`)
  - `SortTh<K extends string>(props: { col: K; label: string; sortKey: K | "none"; sortDir: "asc" | "desc"; onSort: (key: K) => void; align?: "left" | "center" | "right"; className?: string; style?: React.CSSProperties }): JSX.Element`
  - `ColumnVisibilityMenu<K extends string>(props: { allCols: { key: K; label: string }[]; visible: K[]; onChange: (cols: K[]) => void; factoryDefault: K[]; storageKey: string }): JSX.Element`
  - `loadColumnVisibility<K extends string>(storageKey: string, factoryDefault: K[]): K[]`

- [ ] **Step 1: lucide-react 아이콘 import 추가**

`components/portal/ui.tsx` 최상단 import 블록을 다음처럼 바꾼다:

```tsx
import { useEffect, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Info,
  CircleCheck,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Check,
  SlidersHorizontal,
} from "lucide-react"
```

- [ ] **Step 2: 공용 컴포넌트를 `Td` 함수 바로 뒤, `MiniButton` 앞에 삽입**

`export function Td(...) { ... }` 정의가 끝나는 지점(현재 420번째 줄 부근, `/* ---------------- Small action button ---------------- */` 주석 바로 위)에 아래 블록을 통째로 추가한다:

```tsx
/* ---------------- Shared sortable/resizable table conventions ---------------- */

export const TABLE_HEADER_CELL_H = "h-[52px] py-0"
export const TABLE_ROW_CELL_H = "h-16 py-0"

export function loadColumnVisibility<K extends string>(storageKey: string, factoryDefault: K[]): K[] {
  if (typeof window === "undefined") return factoryDefault
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw) return JSON.parse(raw) as K[]
  } catch {}
  return factoryDefault
}

export function SortTh<K extends string>({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
  align = "left",
  className,
  style,
}: {
  col: K
  label: string
  sortKey: K | "none"
  sortDir: "asc" | "desc"
  onSort: (key: K) => void
  align?: "left" | "center" | "right"
  className?: string
  style?: React.CSSProperties
}) {
  const active = sortKey === col
  return (
    <th
      onClick={() => onSort(col)}
      style={style}
      className={cn(
        "cursor-pointer select-none whitespace-nowrap border-b border-border/60 bg-muted/40 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground",
        TABLE_HEADER_CELL_H,
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === "left" && "text-left",
        active && "text-primary",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-primary" />
          ) : (
            <ChevronDown className="h-3 w-3 text-primary" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  )
}

export function ColumnVisibilityMenu<K extends string>({
  allCols,
  visible,
  onChange,
  factoryDefault,
  storageKey,
}: {
  allCols: { key: K; label: string }[]
  visible: K[]
  onChange: (cols: K[]) => void
  factoryDefault: K[]
  storageKey: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  function toggle(key: K) {
    const next = visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key]
    onChange(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }

  function resetToDefault() {
    onChange(factoryDefault)
    window.localStorage.setItem(storageKey, JSON.stringify(factoryDefault))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
          open
            ? "border-primary/50 bg-primary/15 text-primary"
            : "border-border/60 text-muted-foreground hover:text-foreground",
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        컬럼 설정
        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {visible.length}/{allCols.length}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-border/70 bg-card shadow-2xl">
          <ul className="py-1.5">
            {allCols.map(({ key, label }) => {
              const checked = visible.includes(key)
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs transition-colors hover:bg-accent/60"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-border/60",
                      )}
                    >
                      {checked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className={checked ? "text-foreground" : "text-muted-foreground"}>{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-border/50 px-3 py-2">
            <button
              type="button"
              onClick={resetToDefault}
              className="w-full text-center text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              기본값으로 복원
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공 (기존 페이지들은 아직 새 컴포넌트를 import하지 않으므로 이 시점엔 동작 변화 없음 — 목적은 신규 코드 자체의 구문/타입 오류 확인).

- [ ] **Step 4: Commit**

```bash
git add components/portal/ui.tsx
git commit -m "feat: SortTh/ColumnVisibilityMenu 공용 테이블 컴포넌트 추가"
```

---

### Task 2: 자산 목록에 공용 컴포넌트 적용

**Files:**
- Modify: `components/pages/assets-view.tsx`

**Interfaces:**
- Consumes: Task 1의 `SortTh`, `ColumnVisibilityMenu`, `loadColumnVisibility`, `TABLE_HEADER_CELL_H`, `TABLE_ROW_CELL_H` (from `@/components/portal/ui`)

- [ ] **Step 1: import 정리 — 로컬 아이콘/훅 제거, 공용 컴포넌트 추가**

`components/pages/assets-view.tsx` 1~15번째 줄을 다음으로 교체:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Boxes, Search, Eye, Pencil, RefreshCw,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { Tables } from "@/lib/supabase/types"
import {
  PageHeader, StatusBadge, TableShell, Th, Td, MiniButton, ExportExcelButton,
  SortTh, ColumnVisibilityMenu, loadColumnVisibility, TABLE_HEADER_CELL_H, TABLE_ROW_CELL_H,
  type RiskLevel,
} from "@/components/portal/ui"
import { AssetSlideover, type AssetDetail } from "@/components/portal/asset-slideover"
import { useToast } from "@/components/portal/toast"
import { cn } from "@/lib/utils"
```

(`useRef`와 `ChevronUp/ChevronDown/ChevronsUpDown/SlidersHorizontal/Check`는 로컬 `SortTh`/`ColToggle` 삭제 후 더 이상 쓰이지 않으므로 제거한다.)

- [ ] **Step 2: 컬럼 저장 관련 코드 정리**

기존(44~70번째 줄 부근)의

```tsx
const FACTORY_VISIBLE: ColKey[] = [
  "id", "name", "vendor", "category", "version",
  "server", "owner", "vuln", "patch", "eos", "approval", "checked_at",
]
const LS_KEY = "sw_manager_col_visible"
const LS_DEFAULT_KEY = "sw_manager_col_default"

function loadVisible(): ColKey[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as ColKey[]
  } catch {}
  return loadUserDefault()
}
function saveVisible(cols: ColKey[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(cols))
}
function loadUserDefault(): ColKey[] {
  try {
    const raw = localStorage.getItem(LS_DEFAULT_KEY)
    if (raw) return JSON.parse(raw) as ColKey[]
  } catch {}
  return FACTORY_VISIBLE
}
function saveUserDefault(cols: ColKey[]) {
  localStorage.setItem(LS_DEFAULT_KEY, JSON.stringify(cols))
}
```

를 다음으로 교체(단순화 — "기본값으로 저장"/"전체 선택" 기능 제거는 사용자 승인된 스펙 결정):

```tsx
const FACTORY_VISIBLE: ColKey[] = [
  "id", "name", "vendor", "category", "version",
  "server", "owner", "vuln", "patch", "eos", "approval", "checked_at",
]
const LS_KEY = "sw_manager_col_visible"
```

- [ ] **Step 3: 로컬 `SortTh` 함수 삭제**

`/* ── 정렬 헤더 ─...` 주석부터 시작하는 로컬 `function SortTh({ col, label, sortKey, sortDir, onSort }: {...}) { ... }` 함수 전체(원본 128~151번째 줄)를 삭제한다.

- [ ] **Step 4: 로컬 `ColToggle` 함수 삭제**

`/* ── 컬럼 토글 드롭다운 ─...` 주석부터 시작하는 `function ColToggle({...}) { ... }` 함수 전체(원본 153~283번째 줄, `handleSaveDefault`/`handleResetDefault`/`handleSelectAll` 포함)를 삭제한다.

- [ ] **Step 5: `visible` 상태 초기화를 공용 헬퍼로 교체**

기존:
```tsx
const [visible, setVisible] = useState<ColKey[]>(() => {
    if (typeof window === "undefined") return FACTORY_VISIBLE
    return loadVisible()
  })
```

교체 후:
```tsx
const [visible, setVisible] = useState<ColKey[]>(() => loadColumnVisibility(LS_KEY, FACTORY_VISIBLE))
```

- [ ] **Step 6: 테이블 헤더 영역과 `ColToggle` 사용부 교체, `scrollHint` 활성화**

기존(테이블 헤더 액션 바 + `<TableShell>` + `<thead>` + `작업` 헤더):
```tsx
          <div className="flex items-center gap-2">
            <ExportExcelButton
              rows={filtered}
              filename="자산_목록"
              columns={ALL_COLS.filter((c) => show(c.key)).map((c) => ({
                label: c.label,
                value: (a: Asset) => excelValue(a, c.key),
              }))}
            />
            <ColToggle visible={visible} onChange={setVisible} />
          </div>
        </div>

        <TableShell>
          <thead>
            <tr>
              {show("id")         && <SortTh col="id"         label="자산 ID"   {...stProps} />}
              {show("name")       && <SortTh col="name"       label="제품명"    {...stProps} />}
              {show("vendor")     && <SortTh col="vendor"     label="벤더"      {...stProps} />}
              {show("category")   && <SortTh col="category"   label="분류"      {...stProps} />}
              {show("version")    && <SortTh col="version"    label="현재 버전" {...stProps} />}
              {show("server")     && <SortTh col="server"     label="설치 서버" {...stProps} />}
              {show("owner")      && <SortTh col="owner"      label="담당자"    {...stProps} />}
              {show("vuln")       && <SortTh col="vuln"       label="취약점"    {...stProps} />}
              {show("patch")      && <SortTh col="patch"      label="패치 상태" {...stProps} />}
              {show("eos")        && <SortTh col="eos"        label="EOS 날짜"  {...stProps} />}
              {show("approval")   && <SortTh col="approval"   label="승인 상태" {...stProps} />}
              {show("checked_at") && <SortTh col="checked_at" label="최근 확인일" {...stProps} />}
              <Th>작업</Th>
            </tr>
          </thead>
```

교체 후:
```tsx
          <div className="flex items-center gap-2">
            <ExportExcelButton
              rows={filtered}
              filename="자산_목록"
              columns={ALL_COLS.filter((c) => show(c.key)).map((c) => ({
                label: c.label,
                value: (a: Asset) => excelValue(a, c.key),
              }))}
            />
            <ColumnVisibilityMenu
              allCols={ALL_COLS}
              visible={visible}
              onChange={setVisible}
              factoryDefault={FACTORY_VISIBLE}
              storageKey={LS_KEY}
            />
          </div>
        </div>

        <TableShell scrollHint>
          <thead>
            <tr>
              {show("id")         && <SortTh col="id"         label="자산 ID"   {...stProps} />}
              {show("name")       && <SortTh col="name"       label="제품명"    {...stProps} />}
              {show("vendor")     && <SortTh col="vendor"     label="벤더"      {...stProps} />}
              {show("category")   && <SortTh col="category"   label="분류"      {...stProps} />}
              {show("version")    && <SortTh col="version"    label="현재 버전" {...stProps} />}
              {show("server")     && <SortTh col="server"     label="설치 서버" {...stProps} />}
              {show("owner")      && <SortTh col="owner"      label="담당자"    {...stProps} />}
              {show("vuln")       && <SortTh col="vuln"       label="취약점"    {...stProps} />}
              {show("patch")      && <SortTh col="patch"      label="패치 상태" {...stProps} />}
              {show("eos")        && <SortTh col="eos"        label="EOS 날짜"  {...stProps} />}
              {show("approval")   && <SortTh col="approval"   label="승인 상태" {...stProps} />}
              {show("checked_at") && <SortTh col="checked_at" label="최근 확인일" {...stProps} />}
              <Th className={TABLE_HEADER_CELL_H}>작업</Th>
            </tr>
          </thead>
```

Note: `stProps`는 `{ sortKey, sortDir, onSort: handleSort }` 그대로 두되, `sortKey`/`onSort`의 타입 `SortKey`(=`keyof Asset | "none"`)가 `SortTh`의 제네릭 `K`로 그대로 추론되므로 코드 변경 불필요.

- [ ] **Step 7: `tbody` 각 셀에 `TABLE_ROW_CELL_H` 적용**

기존 `<tbody>...</tbody>` 전체(원본 435~514번째 줄)를 다음으로 교체:

```tsx
          <tbody>
            {filtered.map((a) => {
              const sv = servers.find((s) => s.name === a.server)
              return (
                <tr key={a.id} className="transition-colors hover:bg-accent/40">
                  {show("id")       && <Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{a.id}</Td>}
                  {show("name")     && <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>{a.name}</Td>}
                  {show("vendor")   && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{a.vendor}</Td>}
                  {show("category") && <Td className={TABLE_ROW_CELL_H}><StatusBadge accent="primary">{a.category}</StatusBadge></Td>}
                  {show("version")  && <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H)}>{a.version}</Td>}
                  {show("server")   && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-foreground">{a.server}</span>
                        {sv && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {sv.hostname} · {sv.ip}
                          </span>
                        )}
                      </div>
                    </Td>
                  )}
                  {show("owner")    && <Td className={TABLE_ROW_CELL_H}>{a.owner}</Td>}
                  {show("vuln")     && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={vulnRisk[a.vuln]} pulse={a.vuln === "Critical"}>
                        {vulnLabel[a.vuln]}
                      </StatusBadge>
                    </Td>
                  )}
                  {show("patch")    && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={patchRisk[a.patch]}>{patchLabel[a.patch]}</StatusBadge>
                    </Td>
                  )}
                  {show("eos")      && (
                    <Td className={cn(
                      "font-mono text-xs",
                      TABLE_ROW_CELL_H,
                      isEosExpired(a.eos) ? "text-destructive font-semibold" : isEosSoon(a.eos) ? "text-eos" : "",
                    )}>
                      {a.eos ?? "-"}
                      {isEosExpired(a.eos) && <span className="ml-1 text-[10px]">[만료]</span>}
                    </Td>
                  )}
                  {show("approval") && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={approvalRisk[a.approval]} pulse={a.approval === "긴급"}>
                        {a.approval}
                      </StatusBadge>
                    </Td>
                  )}
                  {show("checked_at") && (
                    <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{formatChecked(a.checked_at)}</Td>
                  )}
                  <Td className={TABLE_ROW_CELL_H}>
                    <div className="flex items-center gap-1.5">
                      <MiniButton accent="primary" onClick={() => setSelected(toDetail(a))}>
                        <Eye className="h-3 w-3" />상세
                      </MiniButton>
                      <MiniButton accent="muted"><Pencil className="h-3 w-3" />수정</MiniButton>
                      <MiniButton accent="success" onClick={() => toast({
                        tone: "info",
                        title: "자산 정보 수집 시작",
                        description: `${a.name} (${a.server}) 최신 버전/패치 상태를 수집합니다.`,
                      })}>
                        <RefreshCw className="h-3 w-3" />수집
                      </MiniButton>
                    </div>
                  </Td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">검색 결과가 없습니다.</span>
                </Td>
              </tr>
            )}
          </tbody>
```

- [ ] **Step 8: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공. 실패 시 미사용 import(`useRef`, 삭제된 아이콘) 잔존 여부 확인.

- [ ] **Step 9: 수동 확인**

Run: `npm run dev`, 브라우저에서 `자산 목록` 메뉴 진입.
확인 항목:
- 헤더 컬럼 클릭 시 정렬 asc/desc 토글되고 화살표 아이콘이 바뀐다.
- "컬럼 설정" 버튼 클릭 시 드롭다운에 체크박스 목록 + "기본값으로 복원"만 있고(전체선택/기본값 저장 버튼 없음), 체크 해제하면 해당 컬럼이 즉시 사라진다.
- 컬럼을 몇 개 껐다가 새로고침해도 설정이 유지된다(localStorage `sw_manager_col_visible`).
- 테이블 폭을 브라우저 창을 좁혀 가로 스크롤이 생기게 하면 양쪽 끝에 그림자 힌트가 보인다.
- 행 높이가 SW 마스터 관리 화면과 비슷하게 넉넉해졌다.

- [ ] **Step 10: Commit**

```bash
git add components/pages/assets-view.tsx
git commit -m "refactor: 자산 목록 테이블에 공용 정렬·컬럼설정·스크롤힌트 적용"
```

---

### Task 3: 패치&취약점 모니터링에 정렬·컬럼설정·스크롤힌트 적용

**Files:**
- Modify: `components/pages/patch-view.tsx`

**Interfaces:**
- Consumes: Task 1의 `SortTh`, `ColumnVisibilityMenu`, `loadColumnVisibility`, `TABLE_HEADER_CELL_H`, `TABLE_ROW_CELL_H`

- [ ] **Step 1: import 추가**

`components/pages/patch-view.tsx` 상단 import를 다음으로 교체(19~35번째 줄):

```tsx
import {
  PageHeader,
  StatCard,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  MiniButton,
  ExportExcelButton,
  SortTh,
  ColumnVisibilityMenu,
  loadColumnVisibility,
  TABLE_HEADER_CELL_H,
  TABLE_ROW_CELL_H,
  type RiskLevel,
} from "@/components/portal/ui"
import { AssetSlideover, type AssetDetail } from "@/components/portal/asset-slideover"
import { useToast } from "@/components/portal/toast"
import type { ViewKey } from "@/components/portal/nav"
import { matchVulnerabilities } from "@/lib/vuln-match"
import { cn } from "@/lib/utils"
```

- [ ] **Step 2: 컬럼/정렬 타입과 헬퍼 추가**

`const REVIEW_FILTERS = ...` 줄(원본 88번째 줄) 바로 뒤에 다음을 추가:

```tsx
type ColKey =
  | "vuln" | "name" | "server" | "owner" | "version" | "patch" | "eos" | "approval"

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: "vuln", label: "심각도" },
  { key: "name", label: "자산" },
  { key: "server", label: "설치 서버" },
  { key: "owner", label: "담당자" },
  { key: "version", label: "현재 → 권고 버전" },
  { key: "patch", label: "패치 상태" },
  { key: "eos", label: "EOS" },
  { key: "approval", label: "검토 상태" },
]
const FACTORY_VISIBLE: ColKey[] = ALL_COLS.map((c) => c.key)
const LS_KEY = "patch_view_columns"

type SortKey = ColKey | "none"
type SortDir = "asc" | "desc"

function sortValue(a: Asset, key: SortKey): string | number {
  if (key === "vuln") return severityRank[a.vuln]
  if (key === "patch") return patchOrder[a.patch]
  if (key === "eos") return a.eos ? new Date(a.eos).getTime() : 0
  if (key === "approval") return approvalOrder[a.approval]
  if (key === "none") return 0
  return String(a[key])
}
```

`severityRank`는 이미 파일에 정의돼 있다(42번째 줄). `patchOrder`, `approvalOrder`는 없으므로 같은 위치에 함께 추가한다:

```tsx
const patchOrder: Record<Asset["patch"], number> = {
  "Patch Required": 0,
  "Patch Available": 1,
  "Up to Date": 2,
}
const approvalOrder: Record<Asset["approval"], number> = {
  긴급: 0,
  확인필요: 1,
  승인대기: 2,
  승인완료: 3,
}
```

- [ ] **Step 3: 컴포넌트 내부에 정렬/컬럼 상태 및 핸들러 추가**

`const [selected, setSelected] = useState<AssetDetail | null>(null)` 줄(원본 122번째 줄) 바로 뒤에 추가:

```tsx
  const [sortKey, setSortKey] = useState<SortKey>("vuln")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [visible, setVisible] = useState<ColKey[]>(() => loadColumnVisibility(LS_KEY, FACTORY_VISIBLE))

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(col)
      setSortDir("asc")
    }
  }
```

- [ ] **Step 4: 정렬 로직을 `filtered` useMemo에 반영**

기존(원본 149~170번째 줄):
```tsx
  const filtered = useMemo(() => {
    return [...matched]
      .filter((a) => {
        const q = query.trim().toLowerCase()
        const adv = advisoryFor(a, vulns)
        const matchesQuery =
          !q ||
          [a.name, a.vendor, a.owner, a.server, adv.cve].some((f) =>
            f.toLowerCase().includes(q),
          )
        const matchesCat = cat === "전체" || a.category === cat
        const matchesSeverity = severity === "전체" || a.vuln === severity
        const matchesReview =
          review === "전체" ||
          (review === "확인 필요" && a.approval === "확인필요") ||
          (review === "승인대기" && a.approval === "승인대기") ||
          (review === "긴급" && a.approval === "긴급") ||
          (review === "처리완료" && a.approval === "승인완료")
        return matchesQuery && matchesCat && matchesSeverity && matchesReview
      })
      .sort((a, b) => severityRank[a.vuln] - severityRank[b.vuln])
  }, [matched, query, cat, severity, review, vulns])
```

교체 후:
```tsx
  const filtered = useMemo(() => {
    return [...matched]
      .filter((a) => {
        const q = query.trim().toLowerCase()
        const adv = advisoryFor(a, vulns)
        const matchesQuery =
          !q ||
          [a.name, a.vendor, a.owner, a.server, adv.cve].some((f) =>
            f.toLowerCase().includes(q),
          )
        const matchesCat = cat === "전체" || a.category === cat
        const matchesSeverity = severity === "전체" || a.vuln === severity
        const matchesReview =
          review === "전체" ||
          (review === "확인 필요" && a.approval === "확인필요") ||
          (review === "승인대기" && a.approval === "승인대기") ||
          (review === "긴급" && a.approval === "긴급") ||
          (review === "처리완료" && a.approval === "승인완료")
        return matchesQuery && matchesCat && matchesSeverity && matchesReview
      })
      .sort((a, b) => {
        const va = sortValue(a, sortKey)
        const vb = sortValue(b, sortKey)
        const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
        return sortDir === "asc" ? d : -d
      })
  }, [matched, query, cat, severity, review, vulns, sortKey, sortDir])

  const show = (key: ColKey) => visible.includes(key)
```

- [ ] **Step 5: 엑셀 버튼 옆에 컬럼 설정 추가, thead를 SortTh로 교체, scrollHint 켜기**

기존(원본 199~301번째 줄 중 action/thead 부분):
```tsx
        action={
          <ExportExcelButton
            rows={filtered}
            filename="패치_취약점_모니터링"
            columns={[
              { label: "심각도", value: (a: Asset) => vulnLabel[a.vuln] },
              { label: "자산", value: (a: Asset) => a.name },
              { label: "설치 서버", value: (a: Asset) => a.server },
              { label: "담당자", value: (a: Asset) => a.owner },
              { label: "현재 버전", value: (a: Asset) => a.version },
              { label: "권고 버전", value: (a: Asset) => a.latest_version ?? "-" },
              { label: "패치 상태", value: (a: Asset) => patchLabel[a.patch] },
              { label: "패치 요약", value: (a: Asset) => advisoryFor(a, vulns).summary },
              { label: "CVE", value: (a: Asset) => advisoryFor(a, vulns).cve },
              { label: "EOS", value: (a: Asset) => a.eos ?? "-" },
              { label: "검토 상태", value: (a: Asset) => a.approval },
            ]}
          />
        }
```
```tsx
        <TableShell>
          <thead>
            <tr>
              <Th>심각도</Th>
              <Th>자산</Th>
              <Th>설치 서버</Th>
              <Th>담당자</Th>
              <Th>현재 → 권고 버전</Th>
              <Th>패치 상태</Th>
              <Th className="min-w-64">패치 요약 (CVE)</Th>
              <Th>EOS</Th>
              <Th>검토 상태</Th>
              <Th>작업</Th>
            </tr>
          </thead>
```

교체 후:
```tsx
        action={
          <div className="flex items-center gap-1.5">
            <ExportExcelButton
              rows={filtered}
              filename="패치_취약점_모니터링"
              columns={[
                { label: "심각도", value: (a: Asset) => vulnLabel[a.vuln] },
                { label: "자산", value: (a: Asset) => a.name },
                { label: "설치 서버", value: (a: Asset) => a.server },
                { label: "담당자", value: (a: Asset) => a.owner },
                { label: "현재 버전", value: (a: Asset) => a.version },
                { label: "권고 버전", value: (a: Asset) => a.latest_version ?? "-" },
                { label: "패치 상태", value: (a: Asset) => patchLabel[a.patch] },
                { label: "패치 요약", value: (a: Asset) => advisoryFor(a, vulns).summary },
                { label: "CVE", value: (a: Asset) => advisoryFor(a, vulns).cve },
                { label: "EOS", value: (a: Asset) => a.eos ?? "-" },
                { label: "검토 상태", value: (a: Asset) => a.approval },
              ]}
            />
            <ColumnVisibilityMenu
              allCols={ALL_COLS}
              visible={visible}
              onChange={setVisible}
              factoryDefault={FACTORY_VISIBLE}
              storageKey={LS_KEY}
            />
          </div>
        }
```
```tsx
        <TableShell scrollHint>
          <thead>
            <tr>
              {show("vuln") && <SortTh col="vuln" label="심각도" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("name") && <SortTh col="name" label="자산" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("server") && <SortTh col="server" label="설치 서버" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("owner") && <SortTh col="owner" label="담당자" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("version") && <SortTh col="version" label="현재 → 권고 버전" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("patch") && <SortTh col="patch" label="패치 상태" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              <Th className={cn("min-w-64", TABLE_HEADER_CELL_H)}>패치 요약 (CVE)</Th>
              {show("eos") && <SortTh col="eos" label="EOS" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              {show("approval") && <SortTh col="approval" label="검토 상태" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
              <Th className={TABLE_HEADER_CELL_H}>작업</Th>
            </tr>
          </thead>
```

("패치 요약 (CVE)" 컬럼은 정렬 대상도, 컬럼 토글 대상도 아니다 — 항상 표시되는 고정 컬럼으로 둔다.)

- [ ] **Step 6: tbody 셀에 `show()`와 `TABLE_ROW_CELL_H` 적용**

기존 `<tbody>...</tbody>` 전체(원본 302~377번째 줄)를 다음으로 교체:

```tsx
        <tbody>
          {filtered.map((a) => {
              const adv = advisoryFor(a, vulns)
              return (
                <tr key={a.id} className="transition-colors hover:bg-accent/40">
                  {show("vuln") && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={vulnRisk[a.vuln]} pulse={a.vuln === "Critical"}>
                        {vulnLabel[a.vuln]}
                      </StatusBadge>
                    </Td>
                  )}
                  {show("name") && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-foreground">{a.name}</span>
                        <span className="text-[11px] text-muted-foreground">{a.vendor} · {a.category}</span>
                      </div>
                    </Td>
                  )}
                  {show("server") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{a.server}</Td>}
                  {show("owner") && <Td className={TABLE_ROW_CELL_H}>{a.owner}</Td>}
                  {show("version") && (
                    <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H)}>
                      {a.version} → <span className="font-semibold text-primary">{a.latest_version ?? "-"}</span>
                    </Td>
                  )}
                  {show("patch") && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={patchRisk[a.patch]}>{patchLabel[a.patch]}</StatusBadge>
                    </Td>
                  )}
                  <Td className={cn("whitespace-normal text-xs", TABLE_ROW_CELL_H)}>
                    <p className="text-foreground">{adv.summary}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{adv.cve}</p>
                  </Td>
                  {show("eos") && <Td className={cn("font-mono text-xs", TABLE_ROW_CELL_H, isEosSoon(a.eos) && "text-eos")}>{a.eos ?? "-"}</Td>}
                  {show("approval") && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={approvalRisk[a.approval]} pulse={a.approval === "긴급"}>
                        {a.approval}
                      </StatusBadge>
                    </Td>
                  )}
                  <Td className={TABLE_ROW_CELL_H}>
                    <div className="flex items-center gap-1.5">
                      <MiniButton accent="primary" onClick={() => setSelected(toDetail(a))}>
                        <Eye className="h-3 w-3" />상세
                      </MiniButton>
                      <MiniButton
                        accent="warning"
                        onClick={() =>
                          toast({
                            tone: "info",
                            title: "담당자 알림 발송",
                            description: `${a.owner} 담당자에게 ${a.name} 패치 권고를 전송했습니다.`,
                          })
                        }
                      >
                        <BellRing className="h-3 w-3" />알림
                      </MiniButton>
                      <MiniButton
                        accent="success"
                        onClick={() =>
                          toast({
                            tone: "success",
                            title: "패치 작업 등록",
                            description: `${a.name} (${a.server}) 패치 작업이 등록되었습니다.`,
                          })
                        }
                      >
                        <Wrench className="h-3 w-3" />패치 요청
                      </MiniButton>
                    </div>
                  </Td>
                </tr>
              )
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">검색 조건에 맞는 항목이 없습니다.</span>
                </Td>
              </tr>
            )}
          </tbody>
```

- [ ] **Step 7: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공.

- [ ] **Step 8: 수동 확인**

Run: `npm run dev`, `패치&취약점 모니터링` 메뉴에서 헤더 클릭 정렬, 컬럼 설정 켜고 끄기, 가로 스크롤 힌트, 행 높이를 확인한다.

- [ ] **Step 9: Commit**

```bash
git add components/pages/patch-view.tsx
git commit -m "feat: 패치&취약점 모니터링 테이블에 정렬·컬럼설정·스크롤힌트 적용"
```

---

### Task 4: 관리자 페이지 — 공식 Source URL 관리에 검색·정렬·컬럼설정 적용

**Files:**
- Modify: `components/pages/admin-view.tsx`

**Interfaces:**
- Consumes: Task 1의 `SortTh`, `ColumnVisibilityMenu`, `loadColumnVisibility`, `TABLE_HEADER_CELL_H`, `TABLE_ROW_CELL_H`

- [ ] **Step 1: import 추가**

`components/pages/admin-view.tsx` 24~35번째 줄의 `@/components/portal/ui` import를 다음으로 교체:

```tsx
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  TableShell,
  Th,
  Td,
  MiniButton,
  ExportExcelButton,
  SortTh,
  ColumnVisibilityMenu,
  loadColumnVisibility,
  TABLE_HEADER_CELL_H,
  TABLE_ROW_CELL_H,
  type Accent,
  type RiskLevel,
} from "@/components/portal/ui"
```

또한 4번째 줄의 lucide-react import에 `Search`를 추가한다(기존 `Settings, Link2, RefreshCw, ...` 목록에 `Search,` 추가).

- [ ] **Step 2: Source 컬럼 정의·정렬 헬퍼 추가**

`const sourceStatusRisk: Record<string, RiskLevel> = { ... }` 줄(원본 102~104번째 줄) 바로 뒤에 추가:

```tsx
type SourceColKey = "name" | "type" | "url" | "cycle" | "last" | "status"
const SOURCE_ALL_COLS: { key: SourceColKey; label: string }[] = [
  { key: "name", label: "제품명" },
  { key: "type", label: "Source 유형" },
  { key: "url", label: "공식 URL" },
  { key: "cycle", label: "수집 주기" },
  { key: "last", label: "마지막 수집" },
  { key: "status", label: "상태" },
]
const SOURCE_FACTORY_VISIBLE: SourceColKey[] = SOURCE_ALL_COLS.map((c) => c.key)
const SOURCE_LS_KEY = "admin_source_columns"

type SourceSortKey = SourceColKey | "none"
const sourceStatusOrder: Record<string, number> = { 실패: 0, 지연: 1, 정상: 2 }

function sourceSortValue(s: Source, key: SourceSortKey): string | number {
  if (key === "status") return sourceStatusOrder[s.status] ?? 99
  if (key === "none") return 0
  return s[key]
}
```

- [ ] **Step 3: `AdminView` 내부에 검색·정렬·컬럼 상태 추가**

`const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set())` 줄(원본 531번째 줄) 바로 뒤에 추가:

```tsx
  const [sourceQuery, setSourceQuery] = useState("")
  const [sourceSortKey, setSourceSortKey] = useState<SourceSortKey>("name")
  const [sourceSortDir, setSourceSortDir] = useState<"asc" | "desc">("asc")
  const [sourceVisible, setSourceVisible] = useState<SourceColKey[]>(() =>
    loadColumnVisibility(SOURCE_LS_KEY, SOURCE_FACTORY_VISIBLE),
  )

  function handleSourceSort(col: SourceSortKey) {
    if (sourceSortKey === col) setSourceSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSourceSortKey(col)
      setSourceSortDir("asc")
    }
  }

  const filteredSources = sources
    .filter((s) => {
      const q = sourceQuery.trim().toLowerCase()
      return !q || [s.name, s.url].some((f) => f.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      const va = sourceSortValue(a, sourceSortKey)
      const vb = sourceSortValue(b, sourceSortKey)
      const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
      return sourceSortDir === "asc" ? d : -d
    })

  const showSourceCol = (key: SourceColKey) => sourceVisible.includes(key)
```

- [ ] **Step 4: Source URL `SectionCard`의 action에 검색·컬럼설정 추가, thead를 SortTh로 교체**

기존 action 블록(원본 745~781번째 줄) 중 `sourceSelectMode`가 아닐 때의 분기를 다음으로 교체:

```tsx
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={sourceQuery}
                  onChange={(e) => setSourceQuery(e.target.value)}
                  placeholder="제품명, URL 검색"
                  className="w-48 rounded-lg border border-border/60 bg-background/50 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                />
              </div>
              <ExportExcelButton
                rows={filteredSources}
                filename="공식_Source_URL_관리"
                columns={[
                  { label: "제품명", value: (s: Source) => s.name },
                  { label: "Source 유형", value: (s: Source) => s.type },
                  { label: "공식 URL", value: (s: Source) => s.url },
                  { label: "수집 주기", value: (s: Source) => s.cycle },
                  { label: "마지막 수집", value: (s: Source) => s.last },
                  { label: "상태", value: (s: Source) => s.status },
                ]}
              />
              <ColumnVisibilityMenu
                allCols={SOURCE_ALL_COLS}
                visible={sourceVisible}
                onChange={setSourceVisible}
                factoryDefault={SOURCE_FACTORY_VISIBLE}
                storageKey={SOURCE_LS_KEY}
              />
              <MiniButton accent="primary" onClick={() => setSourcePanel("add")}>
                <Plus className="h-3.5 w-3.5" />
                추가
              </MiniButton>
              <MiniButton accent="destructive" onClick={() => setSourceSelectMode(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </MiniButton>
            </div>
          )
```

이어서 `<TableShell>`부터 `</thead>`까지(원본 786~804번째 줄)를 다음으로 교체:

```tsx
        <TableShell scrollHint>
          <thead>
            <tr>
              {sourceSelectMode ? (
                <Th className={cn("w-8", TABLE_HEADER_CELL_H)}>
                  <input
                    type="checkbox"
                    checked={filteredSources.length > 0 && selectedSourceIds.size === filteredSources.length}
                    onChange={toggleSourceSelectAll}
                    aria-label="전체 선택"
                    className="h-4 w-4 rounded border-border/60 accent-primary"
                  />
                </Th>
              ) : null}
              {showSourceCol("name") && <SortTh col="name" label="제품명" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("type") && <SortTh col="type" label="Source 유형" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("url") && <SortTh col="url" label="공식 URL" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("cycle") && <SortTh col="cycle" label="수집 주기" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("last") && <SortTh col="last" label="마지막 수집" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {showSourceCol("status") && <SortTh col="status" label="상태" sortKey={sourceSortKey} sortDir={sourceSortDir} onSort={handleSourceSort} />}
              {sourceSelectMode ? null : <Th className={TABLE_HEADER_CELL_H}>관리</Th>}
            </tr>
          </thead>
```

- [ ] **Step 5: tbody를 `filteredSources` 기준으로, `showSourceCol()`/`TABLE_ROW_CELL_H` 적용**

기존 `<tbody>...</tbody>` 전체(원본 805~863번째 줄)를 다음으로 교체:

```tsx
          <tbody>
            {filteredSources.map((s) =>
              sourcePanel === s.id ? (
                <tr key={s.id}>
                  <td colSpan={7} className="border-b border-border/40 p-0">
                    <SourceFormPanel
                      initial={{
                        name: s.name,
                        type: s.type,
                        url: s.url,
                        cycle: s.cycle,
                        status: s.status,
                      }}
                      onCancel={() => setSourcePanel(null)}
                      onSubmit={saveSource}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={s.id} className="transition-colors hover:bg-accent/40">
                  {sourceSelectMode ? (
                    <Td className={TABLE_ROW_CELL_H}>
                      <input
                        type="checkbox"
                        checked={selectedSourceIds.has(s.id)}
                        onChange={() => toggleSourceSelected(s.id)}
                        aria-label={`${s.name} 선택`}
                        className="h-4 w-4 rounded border-border/60 accent-primary"
                      />
                    </Td>
                  ) : null}
                  {showSourceCol("name") && <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>{s.name}</Td>}
                  {showSourceCol("type") && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{s.type}</Td>}
                  {showSourceCol("url") && <Td className={cn("font-mono text-xs text-primary", TABLE_ROW_CELL_H)}>{s.url}</Td>}
                  {showSourceCol("cycle") && <Td className={cn("text-xs", TABLE_ROW_CELL_H)}>{s.cycle}</Td>}
                  {showSourceCol("last") && <Td className={cn("text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{s.last}</Td>}
                  {showSourceCol("status") && (
                    <Td className={TABLE_ROW_CELL_H}>
                      <StatusBadge risk={sourceStatusRisk[s.status]} pulse={s.status === "실패"}>
                        {s.status}
                      </StatusBadge>
                    </Td>
                  )}
                  {sourceSelectMode ? null : (
                    <Td className={TABLE_ROW_CELL_H}>
                      <div className="flex items-center gap-1.5">
                        <MiniButton onClick={() => setSourcePanel(s.id)}>
                          <Pencil className="h-3 w-3" />
                          수정
                        </MiniButton>
                        <MiniButton accent="destructive" onClick={() => deleteSource(s)}>
                          <Trash2 className="h-3 w-3" />
                          삭제
                        </MiniButton>
                      </div>
                    </Td>
                  )}
                </tr>
              ),
            )}
          </tbody>
```

- [ ] **Step 6: `toggleSourceSelectAll` 기준을 `sources`에서 `filteredSources`로 변경(검색 중 전체선택이 검색결과 기준이 되도록)**

기존:
```tsx
  function toggleSourceSelectAll() {
    setSelectedSourceIds((prev) =>
      prev.size === sources.length ? new Set() : new Set(sources.map((s) => s.id)),
    )
  }
```

교체 후:
```tsx
  function toggleSourceSelectAll() {
    setSelectedSourceIds((prev) =>
      prev.size === filteredSources.length ? new Set() : new Set(filteredSources.map((s) => s.id)),
    )
  }
```

(헤더 체크박스의 `checked` 조건은 Step 4에서 이미 `filteredSources` 기준으로 작성했으므로 추가 수정 불필요.)

- [ ] **Step 7: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공.

- [ ] **Step 8: 수동 확인**

Run: `npm run dev`, `관리자 페이지 → 수집 관리` 탭에서 공식 Source URL 관리 섹션 확인: 검색창으로 필터링, 헤더 클릭 정렬, 컬럼 설정 토글, 기존 선택모드 일괄삭제/추가/수정 폼이 여전히 동작하는지, 가로 스크롤 힌트를 확인한다.

- [ ] **Step 9: Commit**

```bash
git add components/pages/admin-view.tsx
git commit -m "feat: 공식 Source URL 관리에 검색·정렬·컬럼설정·스크롤힌트 적용"
```

---

### Task 5: 관리자 페이지 — 사용자 권한 관리에 검색·정렬·컬럼설정 적용

**Files:**
- Modify: `components/pages/admin-view.tsx`

**Interfaces:**
- Consumes: Task 1의 `SortTh`, `ColumnVisibilityMenu`, `loadColumnVisibility`, `TABLE_HEADER_CELL_H`, `TABLE_ROW_CELL_H`; Task 4의 import 변경(이미 적용됨, 추가 import 불필요)

- [ ] **Step 1: `users` 배열을 컴포넌트 밖에서 그대로 사용 — 컬럼 정의·정렬 헬퍼 추가**

`const roleAccent: Record<string, Accent> = { ... }` 줄(원본 407~409번째 줄) 바로 뒤에 추가:

```tsx
type UserColKey = "name" | "email" | "dept" | "role" | "assets" | "active"
const USER_ALL_COLS: { key: UserColKey; label: string }[] = [
  { key: "name", label: "사용자명" },
  { key: "email", label: "이메일" },
  { key: "dept", label: "부서" },
  { key: "role", label: "권한" },
  { key: "assets", label: "담당 자산 수" },
  { key: "active", label: "상태" },
]
const USER_FACTORY_VISIBLE: UserColKey[] = USER_ALL_COLS.map((c) => c.key)
const USER_LS_KEY = "admin_users_columns"

type UserSortKey = UserColKey | "none"
type UserRow = (typeof users)[number]

function userSortValue(u: UserRow, key: UserSortKey): string | number {
  if (key === "active") return u.active ? 1 : 0
  if (key === "assets") return u.assets
  if (key === "none") return 0
  return u[key]
}
```

- [ ] **Step 2: `AdminView` 내부에 검색·정렬·컬럼 상태 추가**

Task 4의 Step 3에서 추가한 `showSourceCol` 정의 바로 뒤에 이어서 추가:

```tsx
  const [userQuery, setUserQuery] = useState("")
  const [userSortKey, setUserSortKey] = useState<UserSortKey>("name")
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("asc")
  const [userVisible, setUserVisible] = useState<UserColKey[]>(() =>
    loadColumnVisibility(USER_LS_KEY, USER_FACTORY_VISIBLE),
  )

  function handleUserSort(col: UserSortKey) {
    if (userSortKey === col) setUserSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setUserSortKey(col)
      setUserSortDir("asc")
    }
  }

  const filteredUsers = users
    .filter((u) => {
      const q = userQuery.trim().toLowerCase()
      return !q || [u.name, u.email, u.dept].some((f) => f.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      const va = userSortValue(a, userSortKey)
      const vb = userSortValue(b, userSortKey)
      const d = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko")
      return userSortDir === "asc" ? d : -d
    })

  const showUserCol = (key: UserColKey) => userVisible.includes(key)
```

- [ ] **Step 3: 사용자 권한 관리 `SectionCard`의 action에 검색·컬럼설정 추가, thead를 SortTh로 교체**

기존(원본 984~1009번째 줄):
```tsx
      <SectionCard
        title="사용자 권한 관리"
        subtitle="관리자 · 승인자 · 담당자 · 조회 사용자"
        icon={UsersRound}
        action={
          <ExportExcelButton
            rows={users}
            filename="사용자_권한_관리"
            columns={[
              { label: "사용자명", value: (u) => u.name },
              { label: "이메일", value: (u) => u.email },
              { label: "부서", value: (u) => u.dept },
              { label: "권한", value: (u) => u.role },
              { label: "담당 자산 수", value: (u) => u.assets },
              { label: "상태", value: (u) => (u.active ? "활성" : "비활성") },
            ]}
          />
        }
      >
        <TableShell>
          <thead>
            <tr>
              <Th>사용자명</Th><Th>이메일</Th><Th>부서</Th>
              <Th>권한</Th><Th>담당 자산 수</Th><Th>상태</Th>
            </tr>
          </thead>
```

교체 후:
```tsx
      <SectionCard
        title="사용자 권한 관리"
        subtitle="관리자 · 승인자 · 담당자 · 조회 사용자"
        icon={UsersRound}
        action={
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="이름, 이메일, 부서 검색"
                className="w-48 rounded-lg border border-border/60 bg-background/50 py-1.5 pl-8 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
              />
            </div>
            <ExportExcelButton
              rows={filteredUsers}
              filename="사용자_권한_관리"
              columns={[
                { label: "사용자명", value: (u) => u.name },
                { label: "이메일", value: (u) => u.email },
                { label: "부서", value: (u) => u.dept },
                { label: "권한", value: (u) => u.role },
                { label: "담당 자산 수", value: (u) => u.assets },
                { label: "상태", value: (u) => (u.active ? "활성" : "비활성") },
              ]}
            />
            <ColumnVisibilityMenu
              allCols={USER_ALL_COLS}
              visible={userVisible}
              onChange={setUserVisible}
              factoryDefault={USER_FACTORY_VISIBLE}
              storageKey={USER_LS_KEY}
            />
          </div>
        }
      >
        <TableShell scrollHint>
          <thead>
            <tr>
              {showUserCol("name") && <SortTh col="name" label="사용자명" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("email") && <SortTh col="email" label="이메일" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("dept") && <SortTh col="dept" label="부서" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("role") && <SortTh col="role" label="권한" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("assets") && <SortTh col="assets" label="담당 자산 수" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
              {showUserCol("active") && <SortTh col="active" label="상태" sortKey={userSortKey} sortDir={userSortDir} onSort={handleUserSort} />}
            </tr>
          </thead>
```

- [ ] **Step 4: tbody를 `filteredUsers` 기준으로, `showUserCol()`/`TABLE_ROW_CELL_H` 적용**

기존(원본 1010~1025번째 줄):
```tsx
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
```

교체 후:
```tsx
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.email} className="transition-colors hover:bg-accent/40">
                {showUserCol("name") && <Td className={cn("font-semibold", TABLE_ROW_CELL_H)}>{u.name}</Td>}
                {showUserCol("email") && <Td className={cn("font-mono text-xs text-muted-foreground", TABLE_ROW_CELL_H)}>{u.email}</Td>}
                {showUserCol("dept") && <Td className={cn("text-muted-foreground", TABLE_ROW_CELL_H)}>{u.dept}</Td>}
                {showUserCol("role") && <Td className={TABLE_ROW_CELL_H}><StatusBadge accent={roleAccent[u.role]}>{u.role}</StatusBadge></Td>}
                {showUserCol("assets") && <Td className={cn("font-mono", TABLE_ROW_CELL_H)}>{u.assets}</Td>}
                {showUserCol("active") && (
                  <Td className={TABLE_ROW_CELL_H}>
                    <StatusBadge accent={u.active ? "success" : "muted"}>
                      {u.active ? "활성" : "비활성"}
                    </StatusBadge>
                  </Td>
                )}
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <Td className="py-8 text-center text-muted-foreground">
                  <span className="block w-full">검색 결과가 없습니다.</span>
                </Td>
              </tr>
            )}
          </tbody>
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: 컴파일 성공.

- [ ] **Step 6: 수동 확인**

Run: `npm run dev`, `관리자 페이지 → 사용자·로그` 탭에서 사용자 권한 관리 섹션 확인: 검색, 정렬, 컬럼 설정, 가로 스크롤 힌트, 행 높이.

- [ ] **Step 7: Commit**

```bash
git add components/pages/admin-view.tsx
git commit -m "feat: 사용자 권한 관리에 검색·정렬·컬럼설정·스크롤힌트 적용"
```

---

## Post-implementation check

- [ ] `npm run lint` 실행 — 이번 변경으로 인한 새 미사용 import/변수 경고가 없는지 확인 (Task별로 지운 로컬 함수가 쓰던 import는 각 Task의 Step 1에서 이미 정리됨)
- [ ] 4개 화면을 모두 admin/일반 역할 전환하며 한 번씩 열어보고 화면이 깨지지 않는지 최종 확인
