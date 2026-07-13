# asset-boards.tsx 실데이터 연결 설계

## 배경

`components/dashboard/asset-boards.tsx`는 `AssetDashboardView`(자산 대시보드) 하단에 렌더링되는 3분할 위젯(`AssetBoards`)으로, 공지사항 / SW 자산 변경 요청 / EOS·패치·보안공지 피드를 요약해 보여준다. 현재 세 패널(`NoticePanel`, `ChangeRequestPanel`, `FeedPanel`) 모두 하드코딩된 배열을 렌더링할 뿐 Supabase 호출이 없다.

대응하는 실 테이블(`notices`, `asset_requests`, `vulnerabilities`)은 이미 스키마에 존재하고 다른 화면(`notice-boards.tsx`, `approval-view.tsx`, `patch-view.tsx`)에서 이미 실사용 중이므로, 이번 작업은 순수 연결 작업이다. `asset-dashboard-view.tsx`는 `<AssetBoards />`를 props 없이 렌더링하고 있으며 이 관계는 유지한다.

## 범위

- `components/dashboard/asset-boards.tsx`의 세 패널을 각각 대응 테이블에 연결
- `AssetBoards`는 계속 props 없이 독립 동작 — 각 패널이 자체 `useEffect`로 Supabase를 호출한다 (`notice-boards.tsx`의 `NoticeBoard`가 이미 쓰는 self-fetch 패턴과 동일). `asset-dashboard-view.tsx`의 기존 `assets` fetch 로직이나 `AssetDashboardView`의 다른 블록은 건드리지 않는다.
- 클릭 인터랙션(토스트 상세 등)은 추가하지 않는다 — 읽기 전용 요약 위젯 성격 유지.

## 패널별 설계

### 1. NoticePanel → `notices` 테이블

- 쿼리: `supabase.from("notices").select("*").order("created_at", { ascending: false }).limit(4)`
- `tag` = `n.category` (시드 데이터 기준 값: 시스템/운영/승인/보고서)
- `tagAccent`는 `notice-boards.tsx`의 `categoryAccent` 맵과 동일한 매핑을 이 파일 내에 재정의: 시스템→primary, 운영→success, 승인→eos, 보고서→muted, 그 외 값은 muted로 폴백
- `date` 표시는 `n.created_at`을 `new Date(...).toLocaleDateString("ko-KR")`로 포맷
- 빈 배열이면 목록 자리에 "등록된 공지사항이 없습니다." 안내 문구 (다른 패널들의 empty-state 문구와 톤 통일, 각 패널 문구는 해당 패널 소재에 맞게 조정)

### 2. ChangeRequestPanel → `asset_requests` 테이블

- 쿼리: `supabase.from("asset_requests").select("*").order("created_at", { ascending: false }).limit(4)`
- 아이콘: 전 항목 동일하게 `Package` 하나만 사용한다 — 실 스키마에는 "등록/변경/담당자변경/폐기" 같은 요청 유형 구분 필드가 없으므로(요청은 전부 "신규 자산 등록 요청" 한 종류, `request-view.tsx` 확인 완료) 목업의 4종 아이콘 분기는 제거하고 존재하지 않는 유형 구분을 지어내지 않는다
- 색상 박스는 기존처럼 상태 기반 배경/텍스트 색이지만, 매핑 대상을 `changeReqRisk`(3-state) 대신 `r.approval` 4개 값 전체로 확장:
  ```ts
  const approvalRisk: Record<AssetRequest["approval"], RiskLevel> = {
    반려: 5, 승인대기: 3, 검토중: 2, 승인완료: 1,
  }
  ```
  (approval-view.tsx / notice-boards.tsx에 이미 있는 동일 이름의 맵과 값이 같다 — 이 파일에도 로컬로 정의)
- `title` = `r.name`
- `requester` 서브텍스트 = `` `${r.requester} · ${r.requester_dept}` ``
- `status` 배지 = `r.approval` 그대로 `StatusBadge`에 표시
- 빈 배열이면 "등록된 자산 변경 요청이 없습니다." 안내 문구

### 3. FeedPanel → `vulnerabilities` 테이블

- 쿼리: `supabase.from("vulnerabilities").select("*").order("collected_at", { ascending: false }).limit(4)`
- `notice_type`(`"CVE" | "Patch" | "EOS"`) 기준으로 아이콘·accent 매핑 — `patch-view.tsx`의 `noticeTypeAccent`와 동일한 값을 이 파일에 로컬로 재정의:
  ```ts
  const noticeTypeAccent: Record<Vulnerability["notice_type"], Accent> = {
    CVE: "destructive", Patch: "warning", EOS: "eos",
  }
  const noticeTypeIcon: Record<Vulnerability["notice_type"], typeof CalendarX> = {
    CVE: ShieldAlert, Patch: Package, EOS: CalendarX,
  }
  ```
- `text` = `v.title`
- `meta` = `` `${v.product} · ${formatCollected(v.collected_at)}` ``
- `formatCollected`는 `notice-boards.tsx`에 있는 동일 함수를 이 파일에 그대로 복제한다 (상대 시간 포맷: 오늘/어제/날짜). 공유 유틸로 뽑아내지 않는 것은 기존 코드베이스 컨벤션(각 대시보드 위젯 파일이 자체 완결적)을 따른 것.
- 빈 배열이면 "수집된 공지가 없습니다." 안내 문구

## 타입

파일 상단에 아래 타입 alias 추가 (다른 마이그레이션된 파일들과 동일한 패턴):

```ts
import type { Tables } from "@/lib/supabase/types"
type Notice = Tables<"notices">
type AssetRequest = Tables<"asset_requests">
type Vulnerability = Tables<"vulnerabilities">
```

기존에 정의돼 있던 로컬 `Notice`/`ChangeReq`/`Feed` 목업 타입과 `notices`/`changeReqs`/`feeds` 배열, 그리고 `changeReqRisk` 3-state 맵은 삭제한다.

## 로딩 상태

각 패널은 독립적으로 `loading` state를 가진다. 로딩 중에는 `ApprovalView`/`AssetDashboardView`가 쓰는 스켈레톤 펄스 블록(`h-* animate-pulse rounded-xl bg-muted/40`) 2~3개를 리스트 자리에 표시. 데이터 도착 후 `loading=false`로 전환.

## 영향받지 않는 것

- `asset-dashboard-view.tsx`의 `assets` fetch, KPI, 차트 블록, 드래그 순서 로직 — 무변경
- `components/pages/admin-view.tsx` (Source URL 관리 등 목업 3섹션)는 이번 작업 범위 밖, 별도 작업으로 남긴다
