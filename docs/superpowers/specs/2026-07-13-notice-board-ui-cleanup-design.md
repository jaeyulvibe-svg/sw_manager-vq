# 게시판형 화면 UI 정리 — 설계 문서

날짜: 2026-07-13

## 배경 / 목표

아래 8개 화면의 상단 액션바·필터·테이블·삭제 플로우가 화면마다 조금씩 다르게 구현되어 있어 정리가 필요하다.

- KISA 취약점 공지 / 제조사 취약점 공지 / EOS 공지 (`kisa-view.tsx`, `vendor-view.tsx`, `eos-notice-view.tsx` → 공용 `notice-board/notice-review-board.tsx`)
- 공지사항 (`notice-board-view.tsx`)
- 승인된 취약점 공지 (`patch-view.tsx`)
- SW 자산 목록 (`assets-view.tsx`)
- 서버 목록 (`servers-view.tsx`)
- 관리자 페이지의 수집(`admin-view.tsx` sources 탭) / 사용자(`admin-view.tsx` app_users 탭) 관리 — "정책" 탭은 토글 스위치만 있고 테이블이 없어 이번 범위에서 제외.

**절대 건드리지 않는 것**: Supabase 테이블 구조, 수집 API, 승인/반려 핵심 로직(`notice-actions.ts`, `lib/notice-approval.ts`), 자산 매칭 로직(`lib/vuln-match.ts`), 메뉴 구조·라우팅, 대시보드 계산 로직.

## 조사 결과 — 3개 그룹

대상 화면은 현재 구조가 서로 달라 하나의 패턴으로 묶을 수 없다.

| 그룹 | 화면 | 현재 구조 | 삭제 기능 |
|---|---|---|---|
| A | 서버 목록, 공지사항, 관리자·수집(sources), 관리자·사용자(app_users) | 체크박스 선택모드 + 인라인 저장/취소 + `window.confirm` 삭제가 이미 구현된 테이블 | 있음 (단건 + 일괄) |
| B | SW 자산 목록, 승인된 취약점 공지 | 조회·수정 전용 테이블. 이미 접이식 "상세 필터" 패턴 구현됨 | 없음 (원래 없고, 이번에도 추가 안 함) |
| C | KISA/제조사/EOS 공지 (공용 `NoticeReviewBoard`) | 테이블이 아니라 카드 목록 + 우측 상세 패널. 필터는 알약 버튼. 승인/반려만 있음 | 없음 → **이번에 신규 추가** |

## 사용자 확정 사항

1. 그룹 C에 관리자용 삭제(체크박스 + 일괄삭제)를 신규로 추가한다.
2. 구현은 그룹 A → 그룹 B → 그룹 C 순서로 진행한다.
3. `components/portal/ui.tsx`에 공용 `ConfirmDialog`를 추가하고 모든 단건/일괄 삭제가 이를 재사용한다.
4. 심각도 배지(Critical/High/Medium/Low)는 기존 risk 5단계 스케일을 그대로 유지한다(Low는 계속 blue). 승인 상태 배지만 새 팔레트로 분리한다.
5. 그룹 C 삭제는 승인완료 건도 막지 않는다. 대신 확인 모달에 매핑 자산 영향 경고 문구를 넣는다.

## 설계

### 0. 공용 컴포넌트 (`components/portal/ui.tsx`)

**`ConfirmDialog`**
```
{
  open: boolean
  title: string
  description: string
  confirmLabel: string        // 예: "3개 삭제"
  tone?: "danger" | "default" // danger → 확정 버튼 bg-red-600 text-white, default → bg-primary
  onConfirm: () => void
  onCancel: () => void
}
```
- 배경 오버레이 + 중앙 카드. 취소 버튼은 `border-border/60` 아웃라인, 확정 버튼만 tone에 따라 색이 다름.
- 삭제 트리거(단건/일괄) 전부 이 컴포넌트로 통일 — `window.confirm` 전량 대체.

**`SelectionActionBar`**
```
{
  count: number
  onClear: () => void
  onDelete: () => void      // ConfirmDialog를 여는 트리거
  children?: React.ReactNode // 화면별 추가 버튼(그룹 C의 경우 없음, 확장 여지만 남김)
}
```
- 테이블/카드 목록 바로 위, `count > 0`일 때만 렌더링. "N개 선택됨" + children + `[삭제]` + `[선택 해제]`.

**배지 색상 — `Accent`에 2개 추가**
```
info:   승인대기 (blue)
review: 검토중   (purple/indigo)
```
- 기존 `success`(승인완료=green), `destructive`(반려=red)는 재사용.
- 승인 상태 배지는 `risk=` prop 대신 `accent=` prop으로 전환 (심각도용 risk 스케일과 분리). 영향 파일: `notice-review-board.tsx`의 `statusRisk` → `statusAccent`로 교체.
- 심각도(`sevRisk`)는 그대로 유지 — 변경 없음.
- 출처 배지(KISA=blue, 제조사=slate/indigo)는 `patch-view.tsx`의 `sourceTypeAccent`(`kisa: "primary", vendor: "muted"`)가 이미 근접하므로 유지.

**Hover/스타일 컨벤션**
- Hover는 기존 `hover:bg-accent/40`을 유지(다크모드 대응된 은은한 블루 톤). 스펙의 리터럴 `bg-blue-50/40`은 다크모드에서 어긋나므로 적용하지 않음.
- 긴 텍스트: 제목류는 `line-clamp-2 whitespace-normal`, CVE/제품명/서버명은 기존대로 `whitespace-nowrap` 유지.

### 1. 그룹 A — 서버 목록 / 공지사항 / 관리자·수집 / 관리자·사용자

네 화면 모두 `panel`(추가/수정 인라인 폼) + `selectMode`(선택 모드) + `selectedIds` 상태를 이미 갖고 있음. 변경 범위:

- **상단 액션바**: 검색·엑셀·컬럼설정·"추가" 버튼 그대로 두고, "편집" 토글 버튼과 `selectMode` 상태를 제거한다. 체크박스 컬럼과 각 행의 `[수정]/[삭제]` 버튼을 항상 동시에 노출 — 별도 "선택 모드"에 들어가지 않아도 바로 체크 가능하다.
- **선택 시**: `selectedIds.size > 0`이면 테이블 위에 `SelectionActionBar`가 나타난다(기존 선택모드 전용 인라인 "저장/취소" 버튼 자체가 없어짐 — 새 로직).
- **단건 삭제**: 각 행의 `[삭제]` 버튼 → `ConfirmDialog`(제목: `"{name}" 삭제할까요?`, confirmLabel: "1개 삭제") → 확정 시 기존 `deleteServer`/`deleteNotice`/`deleteSource`/`deleteUser` 그대로 실행.
- **일괄 삭제**: `SelectionActionBar`의 `[삭제]` → `ConfirmDialog`(confirmLabel: `"${n}개 삭제"`) → 확정 시 기존 `saveSelection`류 함수 그대로 실행(내부 로직 불변, `window.confirm` 호출부만 제거하고 다이얼로그 콜백으로 교체).
- 작업 컬럼은 `[수정] [삭제]` 유지(작은 버튼, `h-8 px-2.5 text-xs`로 크기 통일). `[상세] [⋯]` 구조는 3단계 우선순위가 낮아 이번 범위에서는 보류.
- 삭제 버튼 스타일: 평소 `border-red-200 text-red-600`, hover `bg-red-50` (기존 `accent="destructive"`가 이미 이 톤에 가까우므로 `MiniButton accent="destructive"`를 그대로 사용).

### 2. 그룹 B — SW 자산 목록 / 승인된 취약점 공지

삭제 기능이 없는 조회·수정 전용 화면이므로 **삭제/체크박스/일괄작업 관련 항목은 적용하지 않는다.** 두 화면 모두 이미 `상세 필터` 아코디언이 구현되어 있어 스타일만 다듬는다.

- 배지 색상을 위 새 팔레트로 교체(승인 상태 배지가 있는 곳만 — `patch-view.tsx`는 승인완료 건만 보여주므로 상태 배지 자체가 없음, 심각도/출처/공지유형 배지만 존재해 변경 없음).
- 제목 컬럼 `line-clamp-2 whitespace-normal` 적용.
- 헤더(`bg-muted/40` 계열은 이미 그룹 A와 동일 톤이라 실질 변경 없음)·hover 스타일 일관성 확인.

### 3. 그룹 C — KISA / 제조사 / EOS 공지 (`notice-review-board.tsx`)

가장 구조가 다른 그룹. 카드+상세 레이아웃 자체는 유지한다(대공사 금지).

- **필터**: 기존 알약 필터(`FILTERS` 배열)를 그대로 두되 `[필터]` 버튼 뒤로 접는다. 검색 입력이 없었으므로 제목/CVE 검색 인풋을 새로 추가(다른 화면과 UX 일관성).
- **체크박스**: 관리자에게만 각 카드 좌상단에 노출. `selectedIds: Set<string>` 신규 상태.
- **선택 작업 바**: 카드 목록 위에 `SelectionActionBar` (children 없음 — 승인/알림 일괄 처리는 이번 범위에서 제외. 자산 매핑 확인이 필요한 개별 판단이 필요한 작업이라 일괄화 시 오승인 위험이 있음).
- **삭제**: `notice-board/notice-actions.ts`에 `deleteNotices(ids: string[])` 신규 함수 추가 — `supabase.from("vulnerabilities").delete().in("id", ids)`. 승인/반려/매칭 로직(`approveNotice`/`rejectNotice`/`matchAssets`)은 전혀 손대지 않음.
- **확인 모달 문구**: "선택한 공지 N개를 삭제할까요?" / "삭제 후에는 목록에서 제거됩니다. 이미 승인 완료되어 자산과 매핑된 공지가 포함되어 있다면 관련 정보에 영향을 줄 수 있습니다." (승인완료 건도 삭제 허용 — 별도 차단 없음)
- 삭제 후 `selectedIds` 초기화 + `refresh()`(`useNoticeData`의 기존 refresh) 호출.

## 영향 파일

- `components/portal/ui.tsx` — `ConfirmDialog`, `SelectionActionBar`, `Accent`에 `info`/`review` 추가
- `components/pages/servers-view.tsx`
- `components/pages/notice-board-view.tsx`
- `components/pages/admin-view.tsx` (sources 탭, users 탭)
- `components/pages/assets-view.tsx` (스타일만)
- `components/pages/patch-view.tsx` (스타일만)
- `components/pages/notice-board/notice-review-board.tsx`
- `components/pages/notice-board/notice-actions.ts` (`deleteNotices` 추가)

## 검증 계획

- 대상 화면: KISA/제조사/EOS 공지, 승인된 취약점 공지, SW 자산 목록, 서버 목록, 공지사항, 관리자 수집/사용자
- 뷰포트: 1536×864, 1440×900, 1280×720 (Chrome 100%)
- 확인 항목: 텍스트/버튼 잘림 없음, 필터 접었을 때 화면 정리됨, 2개 이상 선택 후 일괄 삭제 가능, 삭제 전 확인 모달 항상 노출, 삭제 후 목록·선택 상태 정상 초기화, 기존 승인/반려/매칭 기능 정상 동작.
