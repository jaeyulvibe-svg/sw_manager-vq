# SW 마스터 관리 — 편집형 데이터 그리드 설계

날짜: 2026-07-12
원본 요청서: `SW_마스터_관리_화면_개선_요청서.txt` (사용자 제공)

## 목표

행별 수정·삭제 버튼이 반복되는 현재 SW 마스터 관리 화면을 **엑셀처럼 직접 편집 가능한 데이터 그리드**로 재구성한다. 모든 변경(추가·수정·삭제·상태 변경)은 화면상 임시 상태로만 관리하고, 사용자가 저장 버튼을 눌러 확인 팝업을 거쳐야 DB에 반영된다. 자동 저장은 사용하지 않는다. 기존 화이트·블루 디자인 톤은 유지한다.

## 확정된 결정 사항

| 항목 | 결정 |
|---|---|
| 데이터 저장소 | Supabase `sw_masters` 테이블 신설 (마이그레이션 006) |
| 화면 위치 | 관리자 페이지 하위 메뉴 "SW 마스터 관리" 신설 (전용 화면) |
| 구현 범위 | 핵심 전부 + 경량 부가기능. 엑셀 가져오기·컬럼 드래그 순서 변경·삭제 복구 화면은 추후 과제 |
| 구현 방식 | 자체 구현 그리드 — 기존 TableShell/디자인 시스템 확장, 신규 의존성 없음 |
| 삭제 방식 | 논리 삭제 (`deleted_at`/`deleted_by`), 조회 시 `deleted_at is null` 필터 |
| 수정자 기록 | 실제 auth 부재 → `updated_by`/`deleted_by`에 mock 관리자명 "김관리" 고정 |
| 권한 | 화면 자체가 관리자 전용. 요청서의 3단계 권한(조회/자산 관리자/시스템 관리자)은 실제 auth 도입 시 과제 |
| "수집 소스" 컬럼 | 제외 — Source URL 관리 섹션이 별도 존재하므로 중복 관리 회피 |
| "일괄 수정" | 필드별 버튼(사용 처리/미사용 처리/수집 모드 변경)으로 구체화, 범용 일괄수정 팝업은 만들지 않음 |

## 1. 네비게이션 & 화면 구조

- `components/portal/nav.ts`: `ViewKey`에 `"admin-master"` 추가. 관리자 페이지 그룹(`admin`)의 첫 번째 하위 메뉴로 `{ key: "admin-master", label: "SW 마스터 관리", icon: Database }` 배치. 기존 "수집 관리" 아이콘은 `RefreshCw`로 교체(Database 아이콘을 SW 마스터가 가져감).
- `app/page.tsx`: `renderView()`에 `admin-master` 케이스 추가 → `<SwMasterView />`.
- `components/pages/admin-view.tsx`: SW 마스터 섹션(테이블·폼·선택 삭제 로직) 제거. Source URL 시딩이 참조하는 8개 제품명 목록은 admin-view 내부 상수로 유지.

## 2. DB 스키마 — `supabase/migrations/006_sw_masters.sql`

기존 패턴(text PK 시퀀스, `set_updated_at` 트리거, allow-all RLS)을 따른다.

```sql
create sequence if not exists master_seq start 9;  -- 시드 8건 이후부터

create table if not exists public.sw_masters (
  id           text primary key default 'M-' || lpad(nextval('master_seq')::text, 3, '0'),
  name         text not null,
  vendor       text not null,
  category     text not null check (category in ('OS','WEB','WAS','DB','Middleware','Security')),
  std_version  text not null,
  collect_mode text not null check (collect_mode in ('AUTO','SEMI_AUTO','MANUAL')),
  active       boolean not null default true,
  manager      text,
  note         text,
  updated_by   text,
  deleted_at   timestamptz,
  deleted_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger sw_masters_updated_at
  before update on public.sw_masters
  for each row execute function public.set_updated_at();

create unique index sw_masters_dedup
  on public.sw_masters (name, vendor, std_version)
  where deleted_at is null;

alter table public.sw_masters enable row level security;
create policy "allow_all_sw_masters" on public.sw_masters for all using (true) with check (true);
```

- 시드: 기존 mock 8건(M-001~M-008: Apache Tomcat, JEUS, WebtoB, Oracle Database, OpenSSL, Nginx, RHEL, PostgreSQL)을 명시적 ID로 insert.
- `lib/supabase/types.ts`에 `sw_masters` Row/Insert/Update 타입 추가.

## 3. Draft 상태 모델 (`use-master-draft.ts`)

```ts
type DraftStatus = "added" | "modified" | "deleted"
type MasterDraft = {
  status: DraftStatus
  values: EditableFields        // name, vendor, category, std_version, collect_mode, active, manager, note
  errors?: Partial<Record<keyof EditableFields, string>>  // 검증/저장 실패 메시지
}
// baseline: Map<id, Row>  — DB 원본
// drafts:   Map<id, MasterDraft>
```

동작 규칙:

- **셀 편집**: draft에 병합. 편집 결과가 baseline과 완전히 같아지면 draft 자동 제거(변경 0건 복귀). dirty 셀 판정 = `draft.values[f] !== baseline[f]`.
- **추가**: 임시 ID `NEW-1`, `NEW-2`… 로 `added` draft 생성, 테이블 최상단에 표시. 실제 `M-xxx` ID는 insert 시 DB 시퀀스가 발급.
- **행 복제**: 기존 행 값 복사(제품명 그대로 → 사용자가 버전 등 수정) + `added` draft.
- **삭제**: `deleted` 상태 마킹만. 저장 전 행 단위 취소로 복원 가능. `added` 행을 삭제하면 draft 자체를 제거.
- **파생값**: 추가/수정/삭제 건수, 전체 변경 건수, 변경 이력 목록(행 ID + 변경 필드 요약).

### 저장 흐름

1. 클라이언트 검증 — 필수값(제품명·벤더·분류·표준 버전·수집 모드·사용 여부) + 중복(제품명+벤더+표준 버전, baseline∪drafts 대상, 삭제 예정 행 제외). 실패 시 해당 셀에 오류 표시 + 토스트, 저장 중단.
2. 확인 팝업 — "변경사항을 저장하시겠습니까? 추가 n건 · 수정 n건 · 삭제 n건" [취소/저장].
3. 실행 — 행 단위로 insert(added) / update(modified, `updated_by` 포함) / 논리 삭제(deleted → `deleted_at=now(), deleted_by`).
4. 부분 실패 허용 — 성공 행은 baseline 갱신 후 draft 제거, 실패 행은 draft에 남기고 원인 메시지 표시. 전체 성공 시 "변경사항이 저장되었습니다" 토스트, 저장 후 재조회로 baseline 동기화.

### 취소

- **전체 취소**(상단 버튼): confirm 후 drafts 초기화.
- **행 단위 취소**(행 ⋮ 메뉴): 해당 행 draft만 제거.
- **변경사항 초기화**(하단 바): 전체 취소와 동일.

### 미저장 이탈 경고

- `beforeunload` 리스너(변경 있을 때만).
- 사이드바 이동 가드: `components/portal/unsaved-guard.tsx`에 `UnsavedGuardContext` 신설. view가 가드 함수를 등록하면 `page.tsx`의 뷰 전환 시 confirm("저장하지 않은 변경사항이 있습니다. 페이지를 나가시겠습니까?") 후 이동. 셸 변경은 이 지점뿐.

## 4. 그리드 UI

### 상단 (PageHeader action)

- 변경 상태 텍스트: 변경 있음 → `변경사항 n건 · 저장하지 않음` / 없음 → `변경사항은 저장 버튼을 눌러야 반영됩니다`.
- `[취소]` `[저장 n건]`(변경 0건이면 비활성) `[더보기 ▾]`(엑셀 다운로드 — 기존 `ExportExcelButton` 로직 재사용).

### 검색/필터 바

- 통합 검색: 마스터 ID·제품명·벤더·표준 버전.
- 기본 필터: 분류 / 수집 모드 / 사용 여부.
- `[필터 추가 ▾]`: 벤더, 관리자 필터를 선택적으로 표시. `[초기화]`: 검색·필터·정렬 전부 기본값.

### 선택/일괄 작업 바

- 상시: `[추가]` `[컬럼 설정]`.
- 선택 시: `n개 선택됨` + `[일괄 삭제]` `[사용 처리]` `[미사용 처리]` `[수집 모드 변경 ▾]`. 선택 0건이면 비활성.

### 테이블

- 컬럼: ☐ | ⋮ | 마스터 ID | 제품명 | 벤더 | 분류 | 표준 버전 | 수집 모드 | 사용 여부 | 최근 갱신일. 선택 컬럼(기본 숨김): 관리자, 수정자, 등록일, 비고.
- 정렬: 헤더 클릭 3단계(없음→↑→↓→없음), Shift+클릭 다중 정렬(순위 숫자 표시). 아이콘 ↕/↑/↓.
- 셀 편집: 클릭 시 인라인 에디터 — 제품명·표준 버전·관리자·비고(텍스트), 벤더(datalist 검색 입력), 분류·수집 모드(select), 사용 여부(토글). dirty 셀 = 연한 primary 배경 + 좌상단 점.
- 행 상태: 신규 = `신규` 배지 + primary 틴트 + 필수 빈 셀 강조 / 삭제 예정 = 취소선 + destructive 틴트 + `삭제 예정` 배지.
- 행 ⋮ 메뉴: 상세 보기(전체 필드 팝오버) / 행 복제 / 삭제 예정(삭제 예정 행에서는 "삭제 취소") / 변경 취소.
- 수집 모드 툴팁: AUTO(API/RSS 자동 수집), SEMI_AUTO(자동 수집 후 관리자 보정), MANUAL(관리자 직접 입력).
- 페이징: 표시 개수 10/20/50 + 이전/다음, 클라이언트 사이드. 검색·필터·정렬·페이징 상태는 편집/저장 중 유지.
- 컬럼 설정: 팝오버 체크박스(표시/숨김) + 기본값 복원, `localStorage`(`sw-master-columns`) 저장.

### 하단 변경 이력 바 (변경 있을 때만)

- `변경 이력 n건` + `M-001 제품명 수정` 형식 목록. 클릭 시 해당 행 페이지로 이동 + 스크롤 + 하이라이트.
- 우측 `[변경사항 초기화]` `[저장 n건]`.

## 5. 검증 & 에러 처리

- 필수값 검증: 저장 시 일괄 + 신규 행은 빈 필수 셀 상시 강조.
- 중복 검사: 편집 시점 즉시(클라이언트) + DB unique partial index(서버 방어선). 메시지 "동일한 SW 마스터가 이미 존재합니다".
- 저장 부분 실패: 실패 행에 오류 배지 + 원인, 성공 행만 커밋.
- Supabase 오류는 행 단위로 수집해 표시하며 토스트로 요약.

## 6. 파일 구성

| 파일 | 역할 |
|---|---|
| `supabase/migrations/006_sw_masters.sql` | 신규 |
| `lib/supabase/types.ts` | `sw_masters` 타입 추가 |
| `components/pages/sw-master/use-master-draft.ts` | draft 상태 훅 (UI 비의존 순수 로직) |
| `components/pages/sw-master/cells.tsx` | 인라인 에디터 셀·배지·툴팁·행 메뉴 |
| `components/pages/sw-master-view.tsx` | 화면 본체 (툴바·테이블·페이징·변경 이력 바) |
| `components/portal/unsaved-guard.tsx` | 미저장 이탈 가드 컨텍스트 (신규) |
| `components/portal/nav.ts` | `admin-master` 메뉴 추가 |
| `app/page.tsx` | 라우팅 케이스 + 가드 연결 |
| `components/pages/admin-view.tsx` | SW 마스터 섹션 제거 |

## 7. 검증 방법

테스트 스위트가 없으므로:

1. `pnpm lint`, `pnpm build` 통과.
2. 개발 서버에서 E2E 수동 확인: 추가→셀 편집→행 복제→삭제 예정→변경 이력 클릭 이동→저장 확인 팝업→저장→새로고침 후 데이터 유지→중복/필수값 오류→전체·행 취소→미저장 이탈 경고(사이드바 이동, 새로고침).

## 추후 과제 (이번 범위 제외)

- 엑셀 가져오기(import)
- 컬럼 드래그 순서 변경
- 삭제 데이터 관리자 복구 화면 (`deleted_at is not null` 조회)
- 실제 auth 기반 3단계 권한(조회 사용자/자산 관리자/시스템 관리자) 및 실제 수정자 기록
- 저장된 변경의 감사 이력(audit log) 테이블
