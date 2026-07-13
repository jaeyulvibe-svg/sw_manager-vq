# 자산 관리 버튼 + 관리자 정책 토글 실연동 설계

## 배경

`migration-auditor` 재스캔 결과, 두 곳에 실제 동작 없이 장식만 하는 컨트롤이 남아있었다:

1. `assets-view.tsx` 행별 `수정`/`수집` 버튼 — `수정`은 onClick 자체가 없고, `수집`은 토스트만 띄우고 아무것도 갱신하지 않는다.
2. `admin-view.tsx`의 `수집 관리` 탭(자동 수집 스케줄러/수집 주기)과 `승인 정책` 탭(토글 4개) — 대응하는 테이블이 없어 로컬 state로만 존재하고, 새로고침하면 초기화된다.

이 문서는 두 곳을 실제 Supabase 연동 및(정책 토글의 경우) 기존 승인/알림 로직에 반영하는 설계를 정의한다.

## A. 자산 관리 — 행별 "수정" 버튼

- `servers-view.tsx`의 즉시반영형 사이드 패널 패턴을 따른다: `panel` state(`"edit:<assetId>" | null`)로 열림 여부 관리.
- 수정 가능 필드는 **담당자(`owner`) / 설치 서버(`server`) / 승인 상태(`approval`)** 3개로 한정한다. 제품명·벤더·분류·버전·EOS·취약점·패치 상태는 SW 마스터/실제 수집 데이터에서 파생되는 값이므로 읽기 전용 유지.
  - `server`는 `servers` 테이블에서 이름 목록을 드롭다운으로 제공(요청 화면의 설치 서버 드롭다운과 동일 패턴).
  - `approval`은 `"승인대기" | "확인필요" | "승인완료" | "긴급"` 셀렉트.
- 저장 시 `supabase.from("assets").update({ owner, server, approval }).eq("id", asset.id)` 후 목록 리로드 + 성공 토스트. 실패 시 에러 토스트(다른 CRUD 화면과 동일 패턴).

## B. 자산 관리 — 행별 "수집" 버튼

- 자산의 `name`이 `/api/collect-source`의 8개 추적 대상 제품(Apache Tomcat, JEUS, WebtoB, Nginx, PostgreSQL, OpenSSL, Red Hat Enterprise Linux, Oracle Database) 중 하나와 일치하면:
  - `fetch("/api/collect-source", { method: "POST", body: { products: [product] } })` 호출 (관리자 페이지 "즉시 수집"과 동일 엔드포인트, 대상만 1개로 제한).
  - 응답 후 `supabase.from("assets").update({ checked_at: new Date().toISOString() }).eq("id", asset.id)` 로 확인일 갱신.
  - 신규 수집 건수(`newCount`)를 토스트에 표시.
- 대상 제품이 아니면 API를 호출하지 않고 "자동 수집 대상 제품이 아닙니다" 안내 토스트만 표시.
- 버튼은 호출 중 로딩 상태(`busyId`)로 중복 클릭 방지.

## C. 관리자 › 수집 관리 탭 — 설정 영속화

새 테이블 `admin_policies` (고정 1행, `id = 'default'`)를 만들어 다음 필드를 저장한다:

```sql
create table admin_policies (
  id                      text primary key default 'default',
  auto_collect_enabled    boolean not null default true,
  collect_interval        text not null default '일 1회'
                            check (collect_interval in ('1시간','6시간','일 1회')),
  critical_urgent_alert   boolean not null default true,
  high_requires_approval  boolean not null default true,
  eos_alert_180d          boolean not null default true,
  queue_after_collect     boolean not null default true,
  updated_at              timestamptz not null default now()
);

insert into admin_policies (id) values ('default');
```

- `AdminView` 마운트 시 이 행을 조회해 두 탭의 토글/셀렉트 초기값으로 사용.
- 값 변경 시 `supabase.from("admin_policies").update({ [field]: value, updated_at: now }).eq("id", "default")` — 즉시 반영형(Source URL 관리와 동일 패턴), 실패 시 롤백 + 에러 토스트.
- `자동 수집 스케줄러`/`수집 주기`는 **값만 저장**한다. 이 앱에는 서버 cron이 없어 토글을 켜도 실제 주기 실행은 일어나지 않는다(사용자 확인 완료) — 추후 Vercel Cron 등 외부 스케줄러를 붙일 때 참조할 설정값으로 존재.

## D. 관리자 › 승인 정책 탭 — 실제 로직 반영

같은 `admin_policies` 행의 4개 boolean을 기존 승인/알림 코드 경로에 연결한다.

### D1. `critical_urgent_alert` ("Critical 자동 긴급 알림")

`notice-actions.ts`의 `approveNotice()`가 정책을 인자로 받아, **severity가 Critical인 공지를 승인할 때만** 이 값으로 알림 생성 여부를 게이팅한다. OFF면 승인·자산 매핑은 그대로 진행되지만 `notifications` insert를 건너뛴다. Critical이 아닌 공지는 이 토글과 무관하게 지금처럼 항상 알림을 생성한다.

### D2. `high_requires_approval` ("High 이상 관리자 승인 필수")

기본값 ON(현재 동작과 동일: 모든 등급이 수동 승인 필요). OFF일 때만 의미가 생긴다: `/api/collect-source`로 수집된 공지 중 **severity가 Medium 또는 Low인 것만** 삽입 즉시 자동 승인 처리(아래 D-공통 로직). High/Critical은 이 토글 값과 무관하게 항상 수동 승인 큐로 들어간다.

### D3. `eos_alert_180d` ("EOS 180일 전 알림")

서버 cron이 없으므로 "지연 실행" 방식으로 구현한다: `AdminView` 마운트 시(관리자가 관리자 페이지를 열 때) 정책이 ON이면 `assets`에서 `eos`가 오늘 ~ 오늘+180일 사이인 행을 조회하고, 각 자산에 대해 **동일 제목의 알림이 이미 존재하는지**(`notifications` where `title = '${asset.name} 지원종료(EOS) 180일 전 알림'`) 확인해 없는 경우에만 `notifications`에 1건 삽입(담당자 알림, 중복 방지를 위해 자산당 1회만).

### D4. `queue_after_collect` ("패치 공지 수집 후 승인 대기 등록")

기본값 ON(현재 스키마 기본값과 동일: 전부 승인대기로 큐잉). OFF면 `/api/collect-source`로 수집된 신규 공지는 **심각도 무관하게** 삽입 즉시 자동 승인 처리한다(D-공통 로직). **수동 등록(관리자 페이지 "패치/취약점 수동 등록")은 이 토글의 영향을 받지 않고 항상 승인대기로 유지** — 사람이 직접 입력한 건은 여전히 검토 절차를 거친다.

### D2/D4 공통: 자동 승인 로직

`/api/collect-source/route.ts`가 insert 직전에 `admin_policies` 행을 조회하고, 각 신규 공지에 대해:

```
autoApprove = !queue_after_collect
           || (!high_requires_approval && severity in ["Medium", "Low"])
```

`autoApprove`인 행은 `approval: "승인완료"`로 삽입하고, `lib/vuln-match.ts`의 `matchAssets()`로 매칭되는 자산을 찾아 `mapped_assets` 개수를 채운 뒤, `notice-actions.ts`의 승인 부수효과(매칭 자산 `approval`을 `확인필요`로 플래그 + `notifications` insert, Critical인 경우 D1 토글로 게이팅)를 서버 라우트 안에서 동일하게 수행한다. `autoApprove`가 아닌 행은 지금처럼 `approval: "승인대기"`로 삽입한다.

### 우선순위 요약 (충돌 방지)

- `queue_after_collect` OFF → 심각도 무관 전부 즉시 승인.
- `queue_after_collect` ON, `high_requires_approval` OFF → Medium/Low만 즉시 승인, High/Critical은 큐잉.
- `queue_after_collect` ON, `high_requires_approval` ON(기본값) → 전부 큐잉(현재와 동일).

## 파일 변경 범위

- `supabase/migrations/012_admin_policies.sql` (신규)
- `components/pages/assets-view.tsx` (수정/수집 버튼 실연동, 편집 패널 추가)
- `components/pages/admin-view.tsx` (정책 로드/저장, Toggle을 controlled로 변경, EOS 지연 체크)
- `components/pages/notice-board/notice-actions.ts` (`approveNotice`에 `criticalUrgentAlert` 정책 인자 추가)
- `app/api/collect-source/route.ts` (정책 조회 + 자동 승인 분기)
- `lib/supabase/types.ts` (`admin_policies` 테이블 타입 추가)

## 테스트 계획

테스트 스위트가 없는 프로젝트이므로 수동 검증으로 갈음한다:
- 자산 관리에서 담당자/서버/승인상태 수정 → 새로고침 후 유지 확인.
- 추적 대상 제품 자산에서 "수집" 클릭 → `checked_at` 갱신 확인, 비대상 제품은 안내 토스트만 뜨는지 확인.
- 관리자 페이지 정책 토글 변경 → 새로고침 후 유지 확인.
- `high_requires_approval` OFF 상태에서 즉시 수집 실행 → Medium/Low 공지가 승인완료로 바로 들어오는지, High/Critical은 승인대기로 남는지 확인.
- `queue_after_collect` OFF 상태에서 즉시 수집 실행 → 전부 승인완료로 들어오는지 확인.
- `critical_urgent_alert` OFF 상태에서 Critical 공지 승인 → 알림이 생성되지 않는지 확인.
- EOS 180일 이내 자산이 있는 상태에서 관리자 페이지 진입 → 알림 1건 생성, 재진입 시 중복 생성되지 않는지 확인.
