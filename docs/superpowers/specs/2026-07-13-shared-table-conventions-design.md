# 공용 테이블 컨벤션 적용 설계

## 배경

SW 마스터 관리 화면(`sw-master-view.tsx`)은 검색/필터, 정렬, 컬럼 폭 조절·표시 설정, 인라인 편집, 변경 이력 등을 갖춘 완전한 편집형 그리드로 다듬어져 있다. 반면 아래 4개 화면은 테이블 UX 수준이 제각각이다.

- **자산 목록** (`assets-view.tsx`) — 실데이터 조회, 단일 컬럼 정렬 + 컬럼 표시/숨김 토글(자체 구현) 있음
- **패치&취약점 모니터링** (`patch-view.tsx`) — 실데이터 조회, 정렬/컬럼 토글 없음
- **공식 Source URL 관리** (`admin-view.tsx` 내 섹션) — 100% mock(`useState`, DB 테이블 없음), 검색/정렬/컬럼 토글 없음
- **사용자 권한 관리** (`admin-view.tsx` 내 섹션) — 100% mock, 검색/정렬/컬럼 토글 없음

이번 작업은 SW 마스터의 **UX/테이블 컨벤션만** 위 4곳에 통일 적용한다. SW 마스터의 인라인 편집, draft/commit, 변경 이력, 다중정렬(Shift클릭), 컬럼 폭 드래그 조절, 페이지네이션은 이번 범위에 포함하지 않는다. DB 스키마 변경도 없다 — Source URL과 사용자 권한은 계속 mock 상태로 유지한다.

## 공통 적용 항목

1. **컬럼 정렬** — 헤더 클릭 시 asc/desc 토글, 화살표 아이콘(`ChevronUp`/`ChevronDown`/`ChevronsUpDown`) 표시. SW 마스터의 Shift 다중정렬은 제외하고 단일 컬럼 클릭 정렬로 통일(기존 자산 목록과 동일한 동작).
2. **컬럼 표시/숨김 설정** — 체크박스 드롭다운 + "기본값으로 복원" 버튼. 컬럼 폭 드래그 조절은 제외. 자산 목록에 있던 "현재 설정을 기본값으로 저장"/"전체 선택" 기능은 사용 빈도가 낮아 제거하고 SW 마스터 방식(기본값 복원만)으로 단순화한다.
3. **헤더/행 높이 통일** — 헤더 52px, 행 64px, 셀 세로 중앙 정렬.
4. **가로 스크롤 힌트** — 기존 `TableShell`의 `scrollHint` prop을 4곳 모두에서 켠다(컴포넌트 자체는 변경 없음).
5. **검색창 추가** — Source URL 관리(제품명·URL), 사용자 권한 관리(이름·이메일·부서)에 검색 입력 1개씩 신규 추가. 카테고리 등 추가 필터는 넣지 않는다.

## 공용 컴포넌트 — `components/portal/ui.tsx`

기존에 `assets-view.tsx`와 `sw-master-view.tsx`가 각자 구현한 정렬 헤더/컬럼 토글 로직을 3, 4번째로 다시 베끼는 대신 공용 컴포넌트로 추출한다. **SW 마스터 화면 자체는 최근에 다듬어진 상태이므로 이번 작업에서 건드리지 않는다** — 새 공용 컴포넌트는 자산 목록·패치·Source URL·사용자 권한 4곳에서만 사용한다.

```ts
export const TABLE_HEADER_CELL_H = "h-[52px] py-0"
export const TABLE_ROW_CELL_H = "h-16 py-0"

export function SortTh<K extends string>(props: {
  col: K
  label: string
  sortKey: K | "none"
  sortDir: "asc" | "desc"
  onSort: (key: K) => void
  align?: "left" | "center" | "right"
  className?: string
  style?: React.CSSProperties
}): JSX.Element

export function ColumnVisibilityMenu<K extends string>(props: {
  allCols: { key: K; label: string }[]
  visible: K[]
  onChange: (cols: K[]) => void
  factoryDefault: K[]
  storageKey: string   // localStorage에 visible 컬럼 목록을 저장/복원
}): JSX.Element
```

- `SortTh`는 클릭 시 같은 컬럼이면 asc↔desc 토글, 다른 컬럼이면 asc로 시작. `TABLE_HEADER_CELL_H` 적용.
- `ColumnVisibilityMenu`는 내부적으로 `storageKey`로 localStorage 읽기/쓰기까지 처리해 각 페이지에서 로드/세이브 보일러플레이트를 반복하지 않는다.
- 기존 `Th`/`Td`/`TableShell`은 변경하지 않는다(className/prop으로 이미 대응 가능).

## 페이지별 적용 내역

### 자산 목록 (`assets-view.tsx`)
- 로컬 `SortTh`/`ColToggle` 함수 삭제 → 공용 컴포넌트로 교체
- 컬럼 저장 키: 기존 `sw_manager_col_visible` 유지 (사용자 로컬 설정 보존), `sw_manager_col_default` 키와 관련 로직은 제거
- 헤더/행에 `TABLE_HEADER_CELL_H`/`TABLE_ROW_CELL_H` 적용
- `TableShell scrollHint` 활성화

### 패치&취약점 모니터링 (`patch-view.tsx`)
- 정적 `Th` → `SortTh`로 교체: 심각도/자산/설치서버/담당자/현재→권고버전(버전 기준)/패치상태/EOS/검토상태
  - 심각도·패치상태·검토상태는 기존 `severityRank`/`patchOrder`/승인 우선순위로 정렬, 나머지는 문자열/날짜 비교
- 기본 정렬은 기존과 동일하게 심각도 오름차순으로 시작
- `ColumnVisibilityMenu` 추가 (저장 키 `patch_view_columns`), 팩토리 기본값 = 현재 표시되는 전체 컬럼
- 헤더/행 높이 통일, `scrollHint` 활성화

### 공식 Source URL 관리 (`admin-view.tsx` 섹션)
- 검색 입력 추가 (제품명·URL 대상, 클라이언트 메모 필터)
- `Th` → `SortTh` 교체: 제품명/Source유형/공식URL/수집주기/마지막수집/상태
- `ColumnVisibilityMenu` 추가 (저장 키 `admin_source_columns`)
- 헤더/행 높이 통일, `scrollHint` 활성화
- 기존 선택모드(체크박스 일괄삭제), 인라인 추가/수정 `SourceFormPanel`, mock 상태(useState) 로직은 그대로 유지

### 사용자 권한 관리 (`admin-view.tsx` 섹션)
- 검색 입력 추가 (이름·이메일·부서 대상)
- `Th` → `SortTh` 교체: 사용자명/이메일/부서/권한/담당자산수/상태
- `ColumnVisibilityMenu` 추가 (저장 키 `admin_users_columns`)
- 헤더/행 높이 통일, `scrollHint` 활성화
- CRUD 기능은 추가하지 않음(범위 밖) — 표시/조회 UX만 개선

## 변경하지 않는 것
- SW 마스터 관리 화면 자체
- DB 스키마 (Source URL, 사용자 권한은 계속 mock)
- 컬럼 폭 드래그 조절, Shift 다중정렬, 페이지네이션
- 기존 CRUD/승인/알림 로직, 필터 칩·아코디언 UI
- Source URL의 기존 일괄삭제(체크박스 선택모드) 기능

## 검증 방법
- `pnpm build` 또는 `npm run build`로 타입/빌드 확인 (본 프로젝트는 `ignoreBuildErrors: true`이므로 런타임 확인이 더 중요)
- `npm run dev`로 4개 화면 각각 직접 열어 정렬 클릭, 컬럼 토글, 검색(Source/사용자), 스크롤 힌트, 헤더/행 높이를 눈으로 확인
- localStorage 키 충돌 없는지 확인 (`sw_manager_col_visible`, `patch_view_columns`, `admin_source_columns`, `admin_users_columns`)
