# 로그인 사용자 스위처 — admin/user 토글을 실제 사용자 목록으로 교체

## 배경

`components/portal/role-context.tsx`의 `RoleProvider`는 `Role = "admin" | "owner"` 이진값만 가지고, 헤더의 `RoleToggle`(`role-toggle.tsx`)로 두 값만 전환할 수 있었다. `sidebar.tsx`의 `CURRENT_USER` 맵은 이 두 역할에 각각 "김관리"/"정재율"이라는 고정 이름을 하드코딩해 붙였을 뿐, 실제 `app_users` 테이블과는 무관했다.

실제 로그인(인증)이 없는 이 앱에서 데모/시연 시 "여러 사용자로 빠르게 왔다갔다 하며 권한별로 화면이 어떻게 보이는지" 보여줘야 하는데, 지금은 두 가지 고정 페르소나만 가능하고 그마저도 알림·조치업무 같은 사용자별 데이터와 연결되어 있지 않았다. 이 문서는 토글을 "등록된 사용자 중 아무나 골라 그 사람으로 로그인한 것처럼 보기" 기능으로 교체하는 설계다.

`app/page.tsx`의 `AuthGate`(비밀번호 기반 로그인 화면)는 이 변경과 무관한 별개의 실제 인증 게이트이며 건드리지 않는다.

## 데이터 모델

`app_users` 테이블(기존, 변경 없음):

```
id, name, email, dept, role("관리자"|"승인자"|"담당자"|"조회 사용자"), active, created_at, updated_at
```

이 테이블의 `role` 4종 중 사이드바 admin-only 메뉴는 **"관리자"인 사람만** 볼 수 있다 — "승인자"는 admin 메뉴에 접근하지 못한다.

## `role-context.tsx` — Provider/훅 내부 교체

`RoleProvider`/`useRole()`이라는 이름은 그대로 유지한다. `isAdmin`만 구조분해하는 7개 파일(`asset-dashboard-view.tsx`, `admin-view.tsx`, `command-palette.tsx`, `patch-tasks-view.tsx`, `notice-board-view.tsx`, `dashboard-view.tsx`, `notice-review-board.tsx`)은 수정 없이 그대로 동작해야 한다. 반면 기존 `role`/`setRole`(이진값)을 사용하던 `sidebar.tsx`, `role-toggle.tsx`는 아래 새 값으로 옮겨간다.

```ts
type AppUserRow = Tables<"app_users">

type RoleContextValue = {
  currentUser: AppUserRow | null
  users: AppUserRow[]          // active=true, 역할순(관리자→승인자→담당자→조회 사용자)·이름순 정렬
  loading: boolean
  setCurrentUserId: (id: string) => void
  isAdmin: boolean             // currentUser?.role === "관리자"
}
```

- 마운트 시 `app_users`에서 `active=true`만 조회 → 역할 랭크(관리자=0, 승인자=1, 담당자=2, 조회 사용자=3) 다음 이름순으로 정렬해 `users`에 저장.
- 초기 `currentUser` 결정: `localStorage["sw-manager-current-user-id"]`에 저장된 id가 조회 결과 안에 있으면 그 사용자, 없으면(최초 방문/삭제된 사용자) 정렬된 목록의 첫 번째(=첫 관리자, 관리자가 없으면 목록 첫 번째) 사용자.
- `setCurrentUserId(id)`: `users`에서 id로 찾아 `currentUser` 갱신 + `localStorage`에 id 저장. 새로고침해도 마지막으로 고른 사용자로 유지된다.
- 기존 `role`/`setRole` export는 제거한다 (사용처가 sidebar/role-toggle 두 곳뿐이라 함께 교체).

## 로그인 스위처 UI — `role-toggle.tsx` → `user-switcher.tsx`

`components/portal/role-toggle.tsx`를 삭제하고 `components/portal/user-switcher.tsx`(`export function UserSwitcher()`)를 신설, `portal-header.tsx`의 `<RoleToggle />` 자리를 `<UserSwitcher />`로 교체한다.

- **트리거 버튼**: 현재 `currentUser`의 아이콘(관리자 → `ShieldCheck`, 그 외 → `UserCog`) + 이름 + 역할 텍스트. `currentUser`가 아직 없으면(로딩 중) 스켈레톤/빈 상태로 비활성 표시.
- **팝오버**: `notification-bell.tsx`에 이미 있는 outside-click/Escape로 닫히는 패턴(`rootRef` + `mousedown`/`keydown` 리스너)을 그대로 재사용한다. 검색창은 두지 않는다(활성 사용자만 대상이라 목록이 짧음).
- **목록**: `users` 배열을 순서 그대로 렌더링. 각 행은 이름 + 부서(`dept`) + 역할 배지(`StatusBadge`, accent는 관리자=`primary`, 승인자=`review`, 담당자=`success`, 조회 사용자=`muted`). 현재 선택된 사용자 행은 체크 아이콘으로 표시.
- 행 클릭 → `setCurrentUserId(user.id)` + 팝오버 닫기. 이 순간 전체 화면이 그 사용자 기준으로 즉시 리렌더된다.

## `sidebar.tsx`

하드코딩된 `CURRENT_USER: Record<Role, {...}>` 맵을 제거한다. 푸터의 "OOO로 접속 중" 표시는 `currentUser?.name`, `currentUser?.role`을 직접 사용(아이콘은 기존처럼 `isAdmin` 기준 `ShieldCheck`/`UserCog` 분기 유지).

## `patch-tasks-view.tsx` — 담당자 드롭다운 제거, 로그인 사용자로 자동 필터

지금은 "실제 로그인이 없어서" 담당자 이름을 고르는 드롭다운으로 "본인 건만 보기"를 시뮬레이션했다. 로그인 스위처가 그 역할을 대신하므로 이 드롭다운은 중복 기능이 되어 제거한다.

- `owners`(`app_users` role=담당자 조회) state와 그 `<select>` UI, 안내 문구를 삭제.
- 필터링: `ownerFilter !== "전체" && task.owner !== ownerFilter` 조건을 `currentUser?.role === "담당자" && task.owner !== currentUser.name`로 교체. 관리자/승인자/조회 사용자로 로그인하면 지금 관리자가 보던 것과 동일하게 전체 조회(수정 불가).
- `canEdit = currentUser?.role === "담당자"` — 담당자로 로그인하면 필터링을 거쳐 이미 본인 담당 행만 보이므로, 보이는 모든 행에 "조치 등록" 버튼이 뜬다.
- 안내 문구를 담당자로 로그인했을 때만 한 줄로: `담당자: {currentUser.name} 님의 조치 건만 표시됩니다.`
- 예외요청 승인/반려 버튼은 기존처럼 `isAdmin`(=관리자로 로그인)만으로 게이팅, 변경 없음.

## 알림(`notifications-context.tsx`) — 사용자별 근사 필터

`notifications.owner`는 담당자 이름을 담는 문자열 컬럼일 뿐 실제 수신자 FK가 아니다. 스키마 변경 없이 이름 문자열 매칭으로 근사 필터링한다 — 자산/업무 담당자와 실제 알림 수신자가 다를 경우 일부 알림이 누락될 수 있다는 한계는 있으나, 데모 목적으로는 즉시 적용 가능한 방식을 택한다.

`NotificationsProvider`는 `useRole()`을 구독한다(이미 `RoleProvider` 안쪽에 중첩되어 있어 문제없음).

- 원본 fetch(`supabase.from("notifications").select("*")...`)는 그대로 전체를 가져와 raw state로 유지.
- `isAdmin || n.owner === currentUser?.name` 조건으로 걸러진 파생 리스트를 만들어 context가 노출하는 `notifications`로 사용. `unreadCount`/`urgentCount`/`approvalCount`(벨 배지 숫자 포함)는 이 파생 리스트 기준으로 계산되므로 자동으로 "내 알림 기준" 숫자가 된다.
- `markAllRead`: 로컬 state 업데이트도 파생 리스트에 해당하는 id만 `read: true`로 바꾸도록 제한. Supabase update 쿼리도 관리자가 아니면 `.eq("owner", currentUser.name)` 조건을 추가해, 다른 사람의 안 읽은 알림까지 실수로 읽음 처리하지 않게 한다.
- `markRead(id)`는 변경 없음(어차피 화면에 보이는 알림만 클릭 가능).

## 파일 변경 범위

- `components/portal/role-context.tsx` — Provider 내부 전면 교체(위 스펙대로), export 이름(`RoleProvider`/`useRole`)은 유지.
- `components/portal/role-toggle.tsx` — 삭제.
- `components/portal/user-switcher.tsx` — 신규.
- `components/portal/portal-header.tsx` — import/사용처를 `RoleToggle` → `UserSwitcher`로 교체.
- `components/portal/sidebar.tsx` — `CURRENT_USER` 맵 제거, `currentUser` 직접 사용.
- `components/portal/notifications-context.tsx` — `useRole()` 구독 + 파생 필터링 로직 추가.
- `components/pages/patch-tasks-view.tsx` — `ownerFilter`/`owners` 제거, `currentUser` 기반 자동 필터로 교체.

## 미포함 (명시적으로 제외)

- 실제 인증/세션 연동 — 여전히 프론트엔드 상태 전환일 뿐, 서버가 "누가 로그인했는지" 검증하지 않는다.
- `notifications` 테이블에 실제 수신자 FK 컬럼 추가 — 문자열 근사 매칭으로 대체.
- "조회 사용자"/"승인자" 역할에 대한 별도 조치업무 자동 배정 로직 — 이 두 역할은 계속 전체 조회만 가능.
- 사용자 목록 검색/페이지네이션 — active 사용자 수가 적다는 전제로 단순 목록만 제공.

## 테스트 계획

테스트 스위트가 없으므로 수동 검증으로 갈음한다.

- 헤더의 사용자 스위처를 열어 관리자 → 승인자 → 담당자 → 조회 사용자 순으로 정렬된 목록이 보이는지, 역할 배지 색상이 맞는지 확인.
- 담당자 한 명을 선택 → 사이드바 푸터 이름이 즉시 바뀌는지, admin-only 메뉴가 사라지는지 확인.
- 같은 담당자로 "내 조치 업무" 이동 → 본인 담당 행만 보이고 "조치 등록" 버튼이 모든 행에 뜨는지 확인. 다른 담당자의 건이 안 보이는지 확인.
- 관리자로 전환 → "내 조치 업무"에서 전체 행이 다시 보이고 수정 버튼은 사라지는지(예외요청 행만 승인/반려 노출) 확인.
- 알림: 담당자 A로 로그인해 벨 아이콘 배지 숫자와 목록이 `owner === A`인 알림만 보이는지 확인 → 관리자로 전환하면 전체가 보이는지 확인.
- 담당자 A로 "전체 읽음 처리" 클릭 → A의 알림만 읽음 처리되고, 관리자로 전환했을 때 다른 사람 알림은 안 읽음 상태가 유지되는지 확인.
- 새로고침(F5) 후에도 마지막으로 선택한 사용자로 유지되는지 확인.
