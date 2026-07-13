# 리스트 화면 행 액션 버튼 통일 설계

## 배경

카드형/게시판형 리스트 화면 10곳(`assets-view.tsx`, `servers-view.tsx`, `sw-master-view.tsx`, `admin-view.tsx`, `notice-board-view.tsx`, `notice-board/notice-review-board.tsx`(kisa/vendor/eos-notice 공유), `patch-tasks-view.tsx`, `patch-view.tsx`, `approval-view.tsx`, `request-view.tsx`)를 실측 조사한 결과, 공용 컴포넌트(`MiniButton`/`ConfirmDialog`/`SelectionActionBar`, `components/portal/ui.tsx`)가 이미 존재함에도 화면마다 채택 정도가 달라 아래처럼 불일치가 발생하고 있다.

- **삭제 확인 방식 3종**: `ConfirmDialog`(servers/admin/notice-board-view/notice-review-board) vs `window.confirm()`(sw-master-view만 이질적, L321·L359) vs 삭제 기능 없음(assets/patch류/approval/request)
- **다중선택 UI 불일치**: 상시 체크박스+`SelectionActionBar`(servers/admin/notice-board-view) vs "편집" 버튼(L438-441)으로 진입하는 자체 선택모드(`selectMode`, L227)+자체 저장/취소 바(L389-399)(sw-master-view만 이질적)
- **행별 삭제 버튼이 행마다 노출**되어 시각적으로 번잡함(servers-view L452-459, admin-view L1301-1309, notice-board-view L463-477 등)
- **행 액션 라벨/순서 제각각**: "상세→수정→수집"(assets) / "수정→삭제"(servers/admin/sw-master) / "상세→수정→삭제"(notice-board-view) / "승인→반려→삭제"(notice-review-board) / "조치 등록"(patch-tasks, 아이콘 없음)
- **같은 화면 안에서도 불일치**: `approval-view.tsx`는 행에서는 `MiniButton`을 쓰지만 우측 상세 패널의 승인/반려 버튼(L356-374)은 완전 커스텀 CSS 마크업

이번 작업은 **행별 액션 버튼의 구성·순서·삭제 트리거 방식만** 통일한다. 상세보기가 열리는 방식(슬라이드오버/인라인확장/마스터-디테일 패널)은 화면 목적에 맞게 설계된 것이므로 이번 범위에서 손대지 않는다. 소프트 삭제(sw-master, `deleted_at`/`active`) vs 하드 삭제라는 내부 동작 차이도 유지한다 — 통일 대상은 확인창 UI와 트리거 방식뿐이다. 삭제 기능이 없는 화면에 새로 삭제 기능을 추가하지도 않는다.

## 공통 원칙

1. **행에는 파괴적 액션(삭제)을 두지 않는다.** 삭제는 화면 상단의 일괄 액션(체크박스 다중선택 + `SelectionActionBar`)으로만 존재한다.
2. **행별 액션 버튼 순서 고정**: 상세(있으면) → 수정(있으면) → 화면 고유 액션(수집/조치등록 등). 아이콘은 상세=`Eye`, 수정=`Pencil`로 고정.
3. **삭제 확인은 전부 공용 `ConfirmDialog`를 사용**한다. `window.confirm()` 등 네이티브 확인창은 쓰지 않는다.
4. 도메인 고유 용어("조치 등록" 등)는 라벨을 유지하되, `MiniButton` 크기·아이콘 유무를 다른 화면과 동일한 규격으로 맞춘다.

## 화면별 적용 내역

### servers-view.tsx / admin-view.tsx / notice-board-view.tsx
이미 상시 체크박스 + `SelectionActionBar` + `ConfirmDialog`를 쓰고 있으므로 구조 변경은 없다. **행의 개별 삭제(Trash2) 버튼만 제거**하고, 그 삭제 동작을 상단 `SelectionActionBar`의 일괄삭제 하나로만 남긴다(단건 삭제는 해당 1개만 체크 후 상단 버튼으로 수행). 남는 행 액션은 수정(Pencil) 하나뿐이므로 순서 문제는 없다.

### sw-master-view.tsx
- "편집" 버튼(L438-441)으로 진입하는 `selectMode` 토글(L227)과, 그 모드에서만 나타나는 체크박스 열(L453, L498)·자체 저장/취소 바(L389-399)를 제거한다.
- 대신 servers-view와 동일하게 **체크박스 열을 상시 노출**시키고, "관리" 열(수정 버튼)도 항상 함께 보이도록 한다 — 즉 selectMode 분기(L453-454, L474, L498-499, L523-524) 자체를 없애고 단일 렌더 경로로 합친다.
- 단건/일괄 삭제 확인을 `window.confirm()`(L321, L359) 대신 `ConfirmDialog`로 교체. 소프트 삭제 로직(`active:false`, `deleted_at`, `deleted_by`)은 그대로 유지.
- 행의 개별 삭제 버튼(L526-533 부근)은 제거하고, 삭제는 상단 `SelectionActionBar`의 일괄삭제로만 수행.

### approval-view.tsx
우측 상세 패널의 승인/반려 버튼(L356-374, 커스텀 CSS 마크업)을 행에서 쓰는 것과 동일한 `MiniButton`으로 교체한다. 순서는 기존과 동일하게 승인→반려 유지. 이 화면은 삭제 개념이 없는 승인/반려 워크플로우이므로 원칙 1(삭제 제거)의 적용 대상이 아니다.

### notice-board/notice-review-board.tsx (kisa/vendor/eos-notice 공유)
상세 패널의 삭제 버튼은 "행 삭제"가 아니라 검토 워크플로우 자체의 액션(반려/폐기 개념)이며, 이미 카드별 체크박스 + `SelectionActionBar` + `ConfirmDialog`로 구성되어 있어 변경하지 않는다.

### patch-tasks-view.tsx
"조치 등록" 버튼(현재 아이콘 없음)에 `Pencil` 아이콘을 추가해 다른 화면의 수정 버튼과 시각적으로 동일한 규격을 갖추게 한다. 라벨은 도메인 용어이므로 유지. 삭제 기능은 추가하지 않는다.

### assets-view.tsx
상세(Eye)→수정(Pencil)→수집(RefreshCw) 순서는 이미 원칙 2와 일치하므로 라벨/아이콘 변경 없음. 삭제 기능은 추가하지 않는다.

### patch-view.tsx / request-view.tsx
행 액션이 없거나("매핑 자산" 펼침만 존재) 아예 없는 읽기전용/이력 화면이므로 변경 없음.

## 변경하지 않는 것
- 상세보기가 열리는 방식(슬라이드오버/인라인확장/마스터-디테일 패널) 자체
- 소프트 삭제 vs 하드 삭제라는 내부 동작 차이
- 인라인 수정 폼(행이 폼으로 바뀌는 패턴) 구조
- 삭제 기능이 없는 화면(assets/patch-tasks/patch-view/request)에 새 삭제 기능 추가
- notice-review-board 상세 패널의 워크플로우 삭제 버튼

## 검증 방법
- `pnpm build`로 타입/빌드 확인 (`ignoreBuildErrors: true`라 런타임 확인이 더 중요)
- `pnpm dev`로 6개 변경 화면(servers/admin/notice-board-view/sw-master/approval + patch-tasks 아이콘)을 직접 열어:
  - 행에 삭제 버튼이 없는지, 체크박스 선택 시 상단에 `SelectionActionBar`가 뜨는지, 삭제가 `ConfirmDialog`로 확인되는지
  - sw-master-view에서 "편집" 토글 없이 체크박스와 수정 버튼이 항상 함께 보이는지, 소프트 삭제(`active=false`)가 여전히 동작하는지
  - approval-view 상세 패널의 승인/반려 버튼이 행과 동일한 스타일(`MiniButton`)로 보이는지
