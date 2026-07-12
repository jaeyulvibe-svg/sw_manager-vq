# SW 마스터 테이블 — 조회/편집 상태 분리 및 배지 UI 설계

## 배경

`sw-master-view.tsx`는 이미 Supabase(`sw_masters`)에 연결된 draft-then-commit 그리드다(저장 버튼을 눌러야 DB 반영, `use-master-draft.ts`). 문제는 표시 레이어: 분류/수집 모드가 항상 노출된 `<select>`, 사용 여부가 항상 노출된 토글 스위치라서 모든 행이 항시 "편집 중"처럼 보인다. 이번 작업은 **데이터/저장 흐름은 그대로 두고, 조회 상태의 시각적 표현과 편집 진입 방식만** 재설계한다.

## 범위

- 포함: 분류/수집 모드/사용 여부 셀의 조회·편집 상태 분리, 신규 배지 컴포넌트, 컬럼 폭·정렬 조정, 제품명/벤더 툴팁, 날짜 포맷 변경.
- 제외: draft/commit/저장 확인 모달/변경 이력 로직 변경 없음. 엑셀 다운로드 컬럼 값 변경 없음(이미 순수 문자열).

## 1. 조회 상태 배지

새 컴포넌트 3종을 `cells.tsx`에 추가(기존 `EditableCollectMode`/`EditableCategory`/`ActiveToggle`은 편집 상태에서만 사용):

- `CollectModeBadge`, `UseStatusBadge` — 정확한 헥스값 지정이 있어 Tailwind arbitrary value로 직접 스타일링(예: `bg-[#F5F3FF] text-[#7C3AED] border-[#C4B5FD]`). 공통 크기 클래스(`h-7 px-2.5 rounded-lg text-[13px] font-bold`)는 두 컴포넌트가 공유하는 내부 헬퍼로 중복 제거.
- `CategoryCell` — 아이콘 + 텍스트, 중립 캡슐(`rounded-full border border-border/50 bg-muted/40`), 드롭다운 화살표 없음. 기존 `EditableCategory`의 캡슐 스타일을 그대로 재사용하고 `<select>` 대신 `<span>{value}</span>`만 렌더링.

세 컴포넌트 모두 `value: string`을 받아 그대로 표시만 한다 — 저장값/엑셀 값은 변경 없음.

## 2. 조회 ↔ 편집 상태 분리

`SwMasterView`에 `editingRowId: string | null` state 추가.

- **더보기 메뉴**: `RowMenu`에 "편집"/"편집 완료" 토글 항목 추가 (`onDetail`/`onDuplicate`처럼 prop으로 콜백 전달).
- **더블클릭**: `<tr onDoubleClick>` → 같은 행이면 닫고, 다른 행이면 그 행으로 전환(동시에 하나만 편집 — 앞서 확인한 요구사항).
- **바깥 클릭**: 기존 `RowMenu`/컬럼 메뉴와 동일한 `document mousedown` outside-click 패턴으로 `editingRowId`를 null로 닫음(테이블 바깥 또는 다른 행 클릭 시).
- `row.id === editingRowId`일 때만 분류/수집모드/사용여부 셀에 기존 `EditableCategory`/`EditableCollectMode`/`ActiveToggle`을 렌더링하고, 그 외에는 `CategoryCell`/`CollectModeBadge`/`UseStatusBadge`를 렌더링. 값 변경은 지금처럼 즉시 `draft.editCell`로 draft에 반영되고, 실제 DB 반영은 여전히 저장 버튼(`handleSaveClick`→`commit`)에서만 일어난다 — 편집 상태는 순수 표시 토글이고 저장 흐름은 무변경.

## 3. 선택 후 일괄 수정

기존 "선택/일괄 작업 바"(`sw-master-view.tsx:613-624`, 지금은 삭제 버튼만 있음)에 다음을 추가:

- `selected.size > 0`일 때만 노출되는 분류/수집모드/사용여부 3개 `<select>` + "적용" 버튼.
- "적용" 클릭 시 선택된 각 값이 채워진 필드에 대해서만 `selected.forEach(id => draft.editCell(id, field, value))` 실행(선택 안 한 필드는 그대로 둠 — 즉 각 select에 "변경 안 함" 기본 옵션을 둔다).
- 개별 행의 `editingRowId`와는 무관 — 일괄 수정은 바 자체의 입력값으로 동작하고 행을 편집 상태로 전환하지 않는다.

## 4. 컬럼 폭 · 정렬

`DEFAULT_COL_WIDTHS` 갱신(요청 값 그대로, px):
`id:140, name: 최소 220(1.5fr 비율 대신 고정폭 그리드가 아니라 실제 <table>이므로 min-width로 근사), vendor: 최소 180, category:150, std_version:120, collect_mode:150, active:110, updated_at:170` — 선택/행메뉴는 기존 `w-8`(32px)을 48px로 확대.

> 주의: 실제 구현은 CSS Grid가 아니라 `<table>` + 컬럼별 리사이즈(`colWidths` state, `localStorage` 저장)다. `minmax(220px, 1.5fr)` 같은 그리드 문법은 그대로 쓸 수 없으니 "기본폭을 220/180px로 넓히고 사용자가 드래그로 추가 확장 가능"하게 맞춘다. 기존에 컬럼폭을 커스텀 저장해둔 사용자는 이번 변경으로 기본값이 바뀌어도 자신의 저장값이 우선 적용됨(기존 동작 유지).

정렬: `Th`/`Td`에 `className="text-left"` (마스터 ID/제품명/벤더, 기존 기본값 유지) vs `className="text-center"` (분류/표준 버전/수집모드/사용여부/최근갱신일 — 신규 추가) 지정. 배지·아이콘은 내부에서 `inline-flex items-center justify-center`로 이미 중앙정렬됨.

## 5. 제품명/벤더 툴팁

기존 앱의 유일한 툴팁 관례인 `title` 속성을 제품명(`EditableText` 표시 래퍼) 과 `CollectModeBadge`처럼 그대로 재사용. 별도 Tooltip 컴포넌트는 만들지 않음(과설계 방지, YAGNI). 조회 상태에서 제품명/벤더 텍스트에 `title={value}`를 얹은 `<span className="truncate">` 래퍼를 추가한다. 편집 상태의 `<input>`은 지금처럼 유지(입력 중에는 캐럿으로 스크롤 가능하므로 툴팁 불필요).

## 6. 최근 갱신일 포맷

`toLocaleString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false })` → `2026.07.12 02:13` 형태로 통일. 적용 위치: 테이블 셀(`sw-master-view.tsx:882-889`)과 상세 모달(`cells.tsx:370`) 둘 다.

## 7. 배지 스타일 상세

요청된 정확한 색상/크기(높이 28px, 패딩 10px, radius 8px, font 13px/700)를 Tailwind arbitrary value로 그대로 반영:

- AUTO: `text-[#7C3AED] bg-[#F5F3FF] border-[#C4B5FD]`
- SEMI_AUTO: `text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE]`
- MANUAL: `text-[#475569] bg-[#F8FAFC] border-[#CBD5E1]`
- 사용: `text-[#15803D] bg-[#F0FDF4] border-[#BBF7D0]`
- 미사용: `text-[#64748B] bg-[#F8FAFC] border-[#CBD5E1]`

## 8. 데이터/표시 분리

이미 만족됨 — `ExportExcelButton`의 `columns[].value()`는 `row.values.collect_mode` 등 원본 문자열을 그대로 반환(`sw-master-view.tsx:416-429`). 배지/아이콘 컴포넌트는 렌더링에만 관여하고 이 매핑은 변경하지 않는다.

## 영향 파일

- `components/pages/sw-master/cells.tsx` — `CollectModeBadge`, `UseStatusBadge`, `CategoryCell` 추가, `RowMenu`에 편집 토글 항목 추가.
- `components/pages/sw-master-view.tsx` — `editingRowId` state, 더블클릭/바깥클릭 핸들러, 조회/편집 분기 렌더링, 일괄 수정 컨트롤, 컬럼 폭 기본값, 정렬 클래스, 날짜 포맷, 제품명/벤더 툴팁.
- `use-master-draft.ts` — 변경 없음(이미 `editCell`이 다건 호출을 지원).

## 검증

- `pnpm dev`로 SW 마스터 화면에서: 조회 상태 배지/캡슐 확인 → 더보기 메뉴 편집/더블클릭/일괄수정 3가지 진입 경로 확인 → 값 변경 후 저장 전에는 배지가 draft 값을 반영하는지, 저장 버튼을 눌러야 실제 반영되는지 확인 → 제품명/벤더 긴 텍스트 툴팁 확인 → 최근갱신일 24시간 표기 확인 → 엑셀 다운로드 값이 순수 텍스트인지 확인.
