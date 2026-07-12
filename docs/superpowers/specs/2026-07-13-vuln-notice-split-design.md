# KISA/제조사 취약점 공지 분리 및 승인 현황 화면 개편 설계

## 배경

현재 `kisa-view.tsx` 하나가 KISA·제조사 공지를 구분 없이 `vulnerabilities` 테이블 전체에서 읽어 리스트+상세 패널로 보여주고, 관리자가 그 자리에서 승인/반려한다. `patch-view.tsx`는 승인된 공지를 반영해 **자산 기준**으로 취약점/패치 현황을 모니터링하는 별도 화면이다.

문제:
1. KISA 공지와 제조사 공지가 `vulnerabilities.source` 자유 텍스트 하나에 섞여 있어 화면 상에서 구분·필터링이 안 된다.
2. 실제로 이 코드베이스에 KISA 자동 수집기는 없다 (`app/api/collect-source/route.ts`는 Apache Tomcat/JEUS/WebtoB, 즉 전부 제조사 공지만 긁어온다). KISA발 데이터는 `admin-view.tsx`의 수동 등록 폼에 담당자가 자유 텍스트로 "KISA 보안공지"라고 직접 입력하는 경우뿐이다.
3. 사용자는 KISA 공지 검토/승인, 제조사 공지 검토/승인, 승인된 공지 전체 조회를 각각 별도 화면에서 하길 원한다.

이번 작업 범위: 화면 분리 + 승인 현황 화면을 공지 중심으로 개편. KISA 실시간 크롤러 추가는 범위 밖(현재도 없고, 이번에도 만들지 않음 — 수동 등록 시 유형만 명시하도록 한다).

## 데이터 모델 변경

`supabase/migrations/008_vulnerability_source_type.sql` 신규 작성:

```sql
ALTER TABLE vulnerabilities
  ADD COLUMN source_type text NOT NULL DEFAULT 'vendor'
  CHECK (source_type IN ('kisa', 'vendor'));

UPDATE vulnerabilities
  SET source_type = 'kisa'
  WHERE source ILIKE '%KISA%';
```

`lib/supabase/types.ts`의 `vulnerabilities` Row/Insert/Update 타입에 `source_type: "kisa" | "vendor"` 추가 (Insert는 optional, default 있음).

연쇄 변경:
- `app/api/collect-source/route.ts`: `collectApacheTomcat`/`collectTmaxSoft`가 만드는 `FoundNotice` 객체에 `source_type: "vendor"` 고정값 추가.
- `admin-view.tsx`의 `ManualVulnFormValues`에 `source_type: "kisa" | "vendor"` 필드 추가, 라디오 버튼 2개(KISA / 제조사)로 입력받아 insert 시 함께 전달. 기존 "출처"(자유 텍스트) 필드는 그대로 두되 보조 설명용으로 남긴다.

## 공용 로직 — `use-notice-data` 훅

`components/pages/notice-board/use-notice-data.ts` 신설:

```ts
export function useNoticeData(sourceType?: "kisa" | "vendor") {
  // vulnerabilities(+source_type 필터), assets 조회
  // matchAssets(v, assets) 기반 matchMap: Map<vulnId, Asset[]>
  // { vulns, assets, matchMap, loading, refresh }
}
```

- 기존 `kisa-view.tsx`의 fetch + `useMemo(matchMap)` 로직을 그대로 이 훅으로 옮긴다. `sourceType` 인자가 있으면 클라이언트 필터(`.eq("source_type", sourceType)` 또는 fetch 후 filter)로 좁힌다.
- 승인/반려 액션(`handleApprove`/`handleReject` — `vulnerabilities.approval` 갱신, 매칭 자산 `assets.approval` 갱신, `notifications` insert)은 `components/pages/notice-board/notice-actions.ts`로 추출해 KISA/제조사 두 화면이 동일 함수를 공유한다. 로직 자체는 현재 `kisa-view.tsx`의 `handleApprove`/`handleReject`와 100% 동일하게 유지하되, `notifications` insert 시 `link_label`을 기존 "패치 모니터링으로 이동" → **"승인된 취약점 공지로 이동"**으로 변경 (`link_view`는 `"patch"` 그대로 유지).

## 페이지별 구성

### KISA 취약점 공지 (`kisa-view.tsx`)
- 기존 리스트+상세 패널 UI(`NoticeReviewBoard`로 이름만 내부 정리, 외부 export는 `KisaView` 유지)를 그대로 두되, `useNoticeData("kisa")`로 데이터를 좁힌다.
- 필터 칩(`전체/Critical/.../미매핑/승인대기`), 승인/반려 버튼, "패치&취약점 모니터링에서 보기" 이동 버튼은 유지 (타깃 뷰는 `patch` 그대로, 라벨만 "승인된 취약점 공지에서 보기"로 변경).
- PageHeader 설명 문구를 "KISA에서 발표한 취약점 공지를 검토·승인" 톤으로 좁힌다.

### 제조사 취약점 공지 (신규 `vendor-view.tsx`)
- `kisa-view.tsx`와 거의 동일한 컴포넌트 구조를 `useNoticeData("vendor")`로 재사용. 두 파일이 사실상 복제가 되는 걸 막기 위해 공통 렌더 부분(필터+리스트+상세 패널+승인/반려 버튼)을 `components/pages/notice-board/notice-review-board.tsx`라는 내부 컴포넌트로 뽑고, `kisa-view.tsx`/`vendor-view.tsx`는 각각 `sourceType`, 타이틀/설명, 아이콘만 다르게 넘기는 얇은 래퍼로 만든다.
- PageHeader: 제목 "제조사 취약점 공지", 설명 "Apache/TmaxSoft 등 제조사 공식 보안 공지를 검토·승인".

### 승인된 취약점 공지 (`patch-view.tsx` 개편)
현재 자산 중심 테이블을 **공지 중심**으로 뒤집는다.

- 행(row) = `vulnerabilities` 중 `approval === "승인완료"` (source_type 무관, KISA+제조사 전체)
- 컬럼: 심각도 / CVE / 제목 / 출처 유형(KISA·제조사 배지) / 출처(source 텍스트) / 영향 제품 / 매핑 자산 수 / 작업
  - 기존 자산 중심 컬럼(설치 서버·담당자·현재→권고버전·EOS·검토상태)은 공지 단위와 맞지 않아 제거. 대신 "매핑 자산 수" 클릭 시 상세 패널/슬라이드오버로 매칭된 자산 목록(자산명·서버·담당자)을 보여준다 (기존 `AssetSlideover` 대신 kisa-view의 매칭 자산 리스트 렌더 방식 재사용).
- 상단 통계 카드 4개는 공지 기준으로 재정의: 전체 승인 건수 / Critical 건수 / High 건수 / 미매핑 건수(승인은 됐지만 매칭 자산이 0인 공지 — 실제 배포 대상이 없어 놓치기 쉬운 케이스라 우선순위로 노출)
- 검색(제목·CVE·제품명·출처), 필터(심각도, 출처유형: 전체/KISA/제조사), 정렬, 컬럼표시설정(`patch_view_columns` 키 유지), 엑셀 export는 공지 기준 컬럼으로 유지
- 기존 자산 단위 "알림"/"패치 요청" mock 버튼(toast만 발생)은 공지 단위 개념과 맞지 않으므로 제거하고, 대신 "매핑 자산 목록 보기" 액션 하나로 단순화한다.
- PageHeader 제목을 "승인된 취약점 공지"로 변경, 설명은 "KISA·제조사에서 승인 완료된 취약점 공지를 전사 자산 매핑 기준으로 조회합니다."
- KISA/제조사 화면으로 돌아가는 이동 버튼 2개 유지 ("KISA 취약점 공지 바로가기", "제조사 취약점 공지 바로가기").

## 내비게이션 (`components/portal/nav.ts`)

`ViewKey`에 `"vendor"` 추가 (`"kisa"`, `"patch"`는 기존 키 재사용 — 라우팅 링크·알림의 `link_view` 값이 깨지지 않도록).

```ts
export type ViewKey =
  | ...
  | "kisa"
  | "vendor"
  | "patch"
  | ...
```

`NAV_ITEMS`에서 기존 개별 `kisa`/`patch` 항목을 제거하고 그룹으로 교체:

```ts
{
  groupKey: "vuln-notice",
  label: "취약점 공지",
  icon: ShieldAlert,
  children: [
    { key: "kisa", label: "KISA 취약점 공지", icon: ShieldAlert },
    { key: "vendor", label: "제조사 취약점 공지", icon: ShieldAlert },
    { key: "patch", label: "승인된 취약점 공지", icon: ShieldCheck },
  ],
}
```

`adminOnly`/`userOnly` 없음 (기존과 동일하게 모든 역할에 노출). `app/page.tsx`의 `renderView()`에 `"vendor"` case 추가.

## 변경하지 않는 것

- `lib/vuln-match.ts`의 매칭 알고리즘(`matchAssets`/`matchVulnerabilities`) 자체
- 승인/반려 시 `assets.approval`/`notifications` 갱신 로직의 동작 방식
- RBAC: 승인/반려 버튼은 계속 `useRole().isAdmin`으로만 제한
- KISA 실시간 자동 수집기 — 여전히 존재하지 않음, 수동 등록만 가능
- `assets`, `servers`, `sw_masters` 등 다른 테이블 스키마

## 마이그레이션 순서 (구현 시 참고)

1. `008_vulnerability_source_type.sql` 작성 및 적용
2. `lib/supabase/types.ts`에 `source_type` 반영
3. `use-notice-data` 훅, `notice-actions.ts`, `notice-review-board.tsx` 신설
4. `kisa-view.tsx`를 훅/공용 컴포넌트 사용으로 리팩터링
5. `vendor-view.tsx` 신규 작성
6. `patch-view.tsx`를 공지 중심으로 개편
7. `admin-view.tsx` 수동 등록 폼에 출처 유형 라디오 추가, `collect-source/route.ts`에 `source_type: "vendor"` 추가
8. `nav.ts`/`page.tsx` 라우팅 반영

## 검증 방법

- `pnpm build`로 타입 확인 (본 프로젝트는 `ignoreBuildErrors: true`라 런타임 확인이 더 중요)
- `pnpm dev`로 KISA/제조사/승인된 공지 3개 화면을 각각 열어:
  - KISA·제조사 화면에서 승인 시 매칭 자산 담당자에게 `notifications`가 insert되는지 Supabase에서 확인
  - 승인 후 해당 공지가 "승인된 취약점 공지" 화면에 즉시 반영되는지 확인
  - 반려 시 두 화면 모두에서 사라지는지 확인
  - 승인된 공지 화면의 검색/필터(출처유형 포함)/정렬/컬럼설정/엑셀 export 동작 확인
  - 관리자 수동 등록 폼에서 "KISA"/"제조사" 라디오 선택에 따라 실제로 올바른 화면에 공지가 나타나는지 확인
- 마이그레이션 후 `SELECT source, source_type FROM vulnerabilities`로 기존 데이터 백필 결과 확인
