# DEMO 데이터 초기화 설계

## 배경

이 앱은 실제 서비스가 아니라 **시연(데모)용**으로 운영된다. 시연 중 담당자가 승인/등록/삭제 등으로 실데이터를 바꿔놓으면, 다음 시연 전에 원래 상태로 되돌릴 방법이 없다. 관리자 페이지에 "DEMO 데이터 설정" 화면을 만들어, 버튼 한 번으로 지정된 기준 데이터로 되돌릴 수 있게 한다. 최초 기준 데이터는 **지금 DB에 있는 데이터를 그대로** 사용한다.

## 데이터 모델 — `demo_snapshots` (신규 테이블)

```sql
create table if not exists public.demo_snapshots (
  id          text primary key default 'default',
  data        jsonb not null,
  captured_at timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

- 단일 행(`id = 'default'`), `admin_policies`와 동일한 패턴.
- `data`는 `{ "assets": [...], "servers": [...], ... }` 형태로 테이블별 전체 행 배열을 담는 하나의 jsonb 객체.
- **포함 테이블(11개)**: `assets`, `servers`, `vulnerabilities`, `asset_requests`, `notifications`, `notices`, `licenses`, `sw_masters`, `sources`, `app_users`, `patch_tasks`
- **제외**: `admin_policies` — "샘플 데이터"가 아니라 운영 설정(자동수집/승인 정책 토글)으로 간주해 초기화 대상에서 뺀다. 데모 중 토글을 바꿔도 초기화 버튼이 그 설정까지 되돌리지 않는다.
- `demo_snapshots` 자신도 당연히 초기화 대상이 아니다.

## SQL 함수 2개

### `save_demo_snapshot()` — 현재 데이터를 기준으로 저장

```sql
create or replace function public.save_demo_snapshot()
returns void language plpgsql security definer as $$
begin
  insert into public.demo_snapshots (id, data, captured_at, updated_at)
  values (
    'default',
    jsonb_build_object(
      'servers',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.servers t),
      'sw_masters',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sw_masters t),
      'sources',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sources t),
      'app_users',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.app_users t),
      'assets',          (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.assets t),
      'vulnerabilities', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.vulnerabilities t),
      'asset_requests',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.asset_requests t),
      'notifications',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.notifications t),
      'notices',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.notices t),
      'licenses',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.licenses t),
      'patch_tasks',     (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.patch_tasks t)
    ),
    now(), now()
  )
  on conflict (id) do update set data = excluded.data, updated_at = now();
end;
$$;

grant execute on function public.save_demo_snapshot() to anon, authenticated;
```

마이그레이션 파일 맨 아래에서 `select public.save_demo_snapshot();`를 한 번 실행한다 — 이 마이그레이션이 적용되는 시점의 실데이터가 곧 최초 기준값이 된다(요청하신 "지금 있는 그대로 저장").

### `reset_demo_data()` — 기준 데이터로 복원

```sql
create or replace function public.reset_demo_data()
returns void language plpgsql security definer as $$
declare
  snap jsonb;
begin
  select data into snap from public.demo_snapshots where id = 'default';
  if snap is null then
    raise exception 'demo snapshot not found — call save_demo_snapshot() first';
  end if;

  -- FK가 걸린 자식 테이블부터 삭제 (licenses/patch_tasks → assets/vulnerabilities 참조, on delete cascade)
  delete from public.patch_tasks;
  delete from public.licenses;
  delete from public.notifications;
  delete from public.asset_requests;
  delete from public.notices;
  delete from public.vulnerabilities;
  delete from public.assets;
  delete from public.servers;
  delete from public.sw_masters;
  delete from public.sources;
  delete from public.app_users;

  -- 참조 대상(부모) 먼저 삽입
  insert into public.servers    select * from jsonb_populate_recordset(null::public.servers,    snap->'servers');
  insert into public.sw_masters select * from jsonb_populate_recordset(null::public.sw_masters,  snap->'sw_masters');
  insert into public.sources    select * from jsonb_populate_recordset(null::public.sources,     snap->'sources');
  insert into public.app_users  select * from jsonb_populate_recordset(null::public.app_users,   snap->'app_users');
  insert into public.assets          select * from jsonb_populate_recordset(null::public.assets,          snap->'assets');
  insert into public.vulnerabilities select * from jsonb_populate_recordset(null::public.vulnerabilities, snap->'vulnerabilities');
  insert into public.asset_requests select * from jsonb_populate_recordset(null::public.asset_requests, snap->'asset_requests');
  insert into public.notifications  select * from jsonb_populate_recordset(null::public.notifications,  snap->'notifications');
  insert into public.notices        select * from jsonb_populate_recordset(null::public.notices,        snap->'notices');
  -- 자식 테이블 마지막
  insert into public.licenses    select * from jsonb_populate_recordset(null::public.licenses,    snap->'licenses');
  insert into public.patch_tasks select * from jsonb_populate_recordset(null::public.patch_tasks, snap->'patch_tasks');
end;
$$;

grant execute on function public.reset_demo_data() to anon, authenticated;
```

- 함수 호출 전체가 하나의 트랜잭션이므로 원자적이다 — 중간에 실패해도 전부 롤백되어 절반만 초기화되는 상태가 생기지 않는다.
- `jsonb_populate_recordset(null::public.<table>, ...)`는 호출 시점의 **실제 테이블 스키마**를 카탈로그에서 읽어 매칭하므로, 이 문서에 적은 컬럼 목록과 실제 컬럼이 완전히 같지 않아도(예: 마이그레이션 파일이 없는 `servers` 테이블) 안전하게 동작한다.
- 시퀀스 기반 기본값(`assets_seq`, `master_seq` 등)은 건드리지 않는다 — 복원된 행은 스냅샷에 저장된 id를 그대로 쓰므로 시퀀스 자체를 되돌릴 필요는 없다(다음 신규 생성 시 번호가 튈 수 있으나 데모 용도이므로 허용).

## 신규 화면 — `admin-demo` ("DEMO 데이터 설정")

### 내비게이션

`components/portal/nav.ts`:
- `ViewKey`에 `"admin-demo"` 추가.
- `admin` 그룹의 `children` 마지막에 `{ key: "admin-demo", label: "DEMO 데이터 설정", icon: RotateCcw }` 추가.

`app/page.tsx`: `case "admin-demo": return <DemoDataView />` 분기 추가, import 추가.

### 화면 구성 — `components/pages/demo-data-view.tsx` (신규)

- `PageHeader` (title: "DEMO 데이터 설정", 아이콘 `RotateCcw`, 설명: 시연 중 바뀐 데이터를 기준 상태로 되돌리는 화면임을 안내).
- `SectionCard` 1개:
  - 현재 기준 스냅샷 정보: `demo_snapshots.captured_at`/`updated_at`을 "마지막 기준 저장: YYYY-MM-DD HH:mm" 형태로 표시(없으면 "저장된 기준 없음").
  - 포함 테이블 안내: 11개 테이블명을 뱃지 형태로 나열 + "정책/설정(admin_policies)은 포함되지 않습니다" 안내 문구.
  - 버튼 2개:
    - **"현재 데이터를 새 기준으로 저장"** (`MiniButton`, 기본/경고 톤) → `ConfirmDialog`(경고성: "지금 데이터가 새 기준이 되고, 이전 기준은 덮어써집니다") → 확인 시 `supabase.rpc('save_demo_snapshot')` → 성공 토스트 + 화면의 기준 시각 갱신.
    - **"샘플 데이터 초기화"** (`MiniButton accent="destructive"`) → `ConfirmDialog`(danger 톤, 기존 `admin-view.tsx`의 `confirmDeleteSources`/`confirmDeleteUsers`와 동일한 상태관리 패턴 재사용: `useState<{ title, confirmLabel } | null>`) → 확인 시 `supabase.rpc('reset_demo_data')` → 성공 토스트 후 `window.location.reload()`.
      - 새로고침하는 이유: 11개 테이블이 대시보드/자산목록/알림센터 등 앱 전역 여러 화면에 각자 로컬 상태로 캐시돼 있어, 부분적으로 무효화하려면 모든 화면을 일일이 고쳐야 한다. 전체 새로고침이 가장 단순하고 확실하다.
- 오직 관리자(`isAdmin`)만 접근 — 기존 `admin` 그룹과 동일하게 `nav.ts`에서 자동 처리됨.

## 파일 변경 범위

- `supabase/migrations/016_demo_snapshots.sql` (신규 — 테이블, 함수 2개, 초기 스냅샷 저장 실행)
- `lib/supabase/types.ts` (`demo_snapshots` 테이블 타입 추가)
- `components/portal/nav.ts` (`ViewKey`, `admin` 그룹 children에 `admin-demo` 추가)
- `components/pages/demo-data-view.tsx` (신규 화면)
- `app/page.tsx` (`renderView()`에 `"admin-demo"` 분기 추가)

## 2차로 미루는 것

- 스냅샷 히스토리(여러 버전 저장/롤백) — 지금은 "기준 1개"만 유지.
- `admin_policies` 초기화 여부를 화면에서 토글로 선택하는 기능.
- 초기화 대상 테이블을 화면에서 커스터마이징하는 기능.

## 테스트 계획

테스트 스위트가 없으므로 수동 검증으로 갈음한다:
1. 마이그레이션 적용 후 `select data from demo_snapshots where id='default'`로 현재 데이터가 실제로 채워졌는지 확인.
2. "DEMO 데이터 설정" 화면에서 기준 저장 시각이 표시되는지 확인.
3. 아무 화면에서나 데이터를 변경(예: 자산 승인상태 변경, 공지 승인, 알림 읽음 처리) → "샘플 데이터 초기화" 실행 → 새로고침 후 변경 전 상태로 되돌아오는지 확인.
4. 초기화 후에도 `admin_policies` 토글 값은 그대로인지 확인(제외 대상이므로).
5. "현재 데이터를 새 기준으로 저장" 실행 → 이후 데이터를 다시 바꾸고 초기화 → 방금 저장한 새 기준으로 돌아오는지 확인(기존 기준이 아니라).
6. 관리자가 아닌 역할(사용자 모드)에서는 "DEMO 데이터 설정" 메뉴 자체가 보이지 않는지 확인.
