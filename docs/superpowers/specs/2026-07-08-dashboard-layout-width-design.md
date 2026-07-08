# 대시보드 레이아웃 폭 확장 및 재배치 UX 개선

날짜: 2026-07-08

## 배경

- 전체 페이지의 본문(오른쪽 레이어) 폭이 좁아 대시보드 위젯과 표가 답답하게 보임.
- 관리자 대시보드 드래그 재배치 기능(`components/portal/dashboard-layout.tsx`)은 마우스 드래그만 지원하며, 순서가 바뀔 때 위치가 즉시 점프해 부자연스러움.

## 목표

1. 모든 페이지의 본문 폭을 현재 대비 +30% 확장.
2. 대시보드 컴포넌트 재배치를 마우스 드래그뿐 아니라 위/아래 화살표 버튼으로도 가능하게 함.
3. 드래그 중 겹치는(드롭 대상) 컴포넌트가 부드러운 색 전환 하이라이트를 보여주고, 순서 변경 시 컴포넌트들이 부드럽게 밀려나는 위치 애니메이션을 적용.

## 범위

- `app/page.tsx`의 공용 `<main>` 래퍼 (모든 `ViewKey`가 이 안에서 렌더링되므로 전 페이지에 자동 적용).
- `components/portal/dashboard-layout.tsx` (`useDashboardOrder`, `DashboardSection`, `LockToggle`) — 자산/보안 두 대시보드(`components/pages/dashboard-view.tsx`, `components/pages/asset-dashboard-view.tsx`)가 공유하는 유일한 재배치 구현체.
- 신규 의존성: `framer-motion` (레이아웃 애니메이션용).

범위 밖: 대시보드가 아닌 다른 화면의 드래그 기능, 표 내부 행 재배치, 접근성 키보드 전체 개편(화살표 버튼은 마우스 클릭 대상으로 추가하며, 별도 키보드 단축키 바인딩은 포함하지 않음).

## 설계

### 1. 본문 폭 +30%

`app/page.tsx`의 `<main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">`에서 `max-w-7xl`(80rem)을 `max-w-[104rem]`(80rem × 1.3 = 104rem)으로 교체. 이 래퍼는 `renderView()`가 반환하는 모든 뷰를 감싸는 유일한 폭 제약이므로, 다른 페이지 컴포넌트를 개별 수정할 필요 없음 (사전 조사에서 페이지별 `max-w-*` 오버라이드 없음을 확인함).

### 2. 화살표 재배치

`useDashboardOrder(storageKey, blockIds)`에 `moveByOffset(id: string, direction: -1 | 1)`를 추가:
- 현재 순서 배열에서 `id`의 인덱스를 찾고, 인접 인덱스와 swap.
- 배열 경계(첫 항목에서 -1, 마지막 항목에서 +1)를 벗어나면 no-op.
- 기존 `moveBefore`와 동일하게 localStorage에 즉시 반영.

`DashboardSection`의 좌상단 그립 핸들 영역을 버튼 클러스터로 확장:
- 기존 그립(드래그 핸들, 시각적 드래그 전용, 클릭 동작 없음)은 유지.
- 그 옆에 위/아래 화살표 아이콘 버튼(`ChevronUp`, `ChevronDown`, lucide-react) 추가.
- `editable`일 때만 렌더링 (기존 그립과 동일 조건).
- `isFirst`/`isLast` prop을 받아 해당 방향 버튼을 `disabled` 처리 (opacity 낮추고 pointer-events 제거).
- 클릭 시 부모의 `onMoveUp`/`onMoveDown` 콜백 호출 → `moveByOffset` 실행.

두 대시보드 뷰(`dashboard-view.tsx`, `asset-dashboard-view.tsx`)에서 `order.map()` 루프 시 `index === 0` / `index === order.length - 1`을 계산해 `isFirst`/`isLast`로 전달하고, `onMoveUp={() => moveByOffset(id, -1)}` / `onMoveDown={() => moveByOffset(id, 1)}`을 연결.

### 3. 드래그 시 부드러운 애니메이션 + 하이라이트

- `framer-motion`을 의존성에 추가.
- `DashboardSection`의 최상위 `div`를 `motion.div`로 변경하고 `layout` prop을 부여. `order` 배열이 바뀌어 DOM 순서가 바뀔 때마다 framer-motion이 FLIP 방식으로 위치 이동을 자동 애니메이션 처리(기존 `transition-opacity`는 유지, 위치 애니메이션만 추가됨).
- 드롭 대상 하이라이트를 위해 `draggingId`와 별도로 `overId` 상태를 두 대시보드 뷰에 추가:
  - `onDragOverTarget(targetId)` 호출 시 `setOverId(targetId)`도 함께 수행 (기존 `moveBefore` 호출 로직은 유지).
  - `onDrop`/`onDragEnd`에서 `overId`를 `null`로 초기화.
- `DashboardSection`은 `isOverTarget` prop을 받아, `isOverTarget && !isDragging`일 때 `bg-primary/10`(배경 하이라이트) + `transition-colors duration-200`을 추가 클래스로 적용. 드래그가 끝나거나 다른 대상으로 넘어가면 자연스럽게 색이 빠짐.

## 컴포넌트 인터페이스 변경 요약

```ts
// dashboard-layout.tsx
useDashboardOrder(storageKey, blockIds): {
  order: string[]
  moveBefore(dragId, targetId): void   // 기존 유지
  moveByOffset(id, direction: -1 | 1): void  // 신규
  reset(): void
}

DashboardSection(props: {
  id, editable, draggingId, onDragStart, onDragOverTarget, onDrop, onDragEnd,
  isOverTarget: boolean      // 신규 — 하이라이트 트리거
  isFirst: boolean           // 신규 — 위 화살표 disabled 여부
  isLast: boolean            // 신규 — 아래 화살표 disabled 여부
  onMoveUp: () => void       // 신규
  onMoveDown: () => void     // 신규
  children
})
```

## 테스트 관점

- 수동 확인: `pnpm dev`로 자산/보안 대시보드 양쪽에서 편집 잠금 해제 후, (a) 드래그 재배치, (b) 화살표 클릭 재배치, (c) 드래그 중 다른 블록 위에 올렸을 때 하이라이트/애니메이션 동작을 확인.
- 본문 폭 확장은 대시보드 외 다른 페이지(자산 목록 표 등)에서도 육안 확인.
- 테스트 스위트가 구성되어 있지 않은 프로젝트이므로 (`CLAUDE.md` 참고) 자동화 테스트는 추가하지 않음.
