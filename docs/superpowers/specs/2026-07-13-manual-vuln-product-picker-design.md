# 패치/취약점 수동 등록 폼 — 제품/버전 선택 및 출처 단순화

## 배경

관리자 페이지(`components/pages/admin-view.tsx`)의 "패치/취약점 수동 등록" 폼(`ManualVulnFormPanel`)은 현재:
- "제품명"을 자유 텍스트 입력으로 받는다 (예: "Apache Tomcat 10.1.x").
- "출처"를 자유 텍스트 입력으로 받고, 별도로 "출처 유형"(KISA/제조사) 라디오도 받는다.

SW 마스터 관리(`sw_masters` 테이블)가 이미 신규 자산 요청(`request-view.tsx`)에서 "제품명 선택 → 버전 선택" 2단계 드롭다운의 소스로 쓰이고 있으므로, 수동 등록 폼도 동일한 패턴을 따르도록 통일한다. 또한 "출처" 자유 입력은 "출처 유형"과 중복되는 정보이므로 제거하고, 출처 유형에서 자동 파생한다.

## 변경 범위

`components/pages/admin-view.tsx` 단일 파일. `vulnerabilities` 테이블 스키마 변경 없음 (`source`는 여전히 NOT NULL이므로 자동 생성한 값을 채운다).

## 데이터 소스

`AdminView`에서 `sw_masters`를 로드한다. `request-view.tsx`와 동일한 쿼리 패턴을 그대로 사용:

```ts
supabase
  .from("sw_masters")
  .select("*")
  .eq("active", true)
  .is("deleted_at", null)
  .order("name")
```

로드 결과(`masters: Tables<"sw_masters">[]`, `mastersLoading: boolean`)를 `ManualVulnFormPanel`에 props로 전달한다.

## 폼 UI 변경

### 1. 제품명 → 버전 (2단계 select)

- **제품명 select**: `masters`에서 이름 중복 제거한 목록(가나다 정렬). placeholder: "SW 마스터에 등록된 제품을 선택하세요" (로딩 중엔 "불러오는 중...", 목록이 비어있으면 "등록된 제품이 없습니다").
- **버전 select**: 제품명 미선택 시 비활성화, placeholder "먼저 제품명을 선택하세요". 제품명 선택 시 해당 이름의 `sw_masters` 행들을 `std_version` 목록으로 보여준다. 값으로는 `master.id`를 저장(`request-view.tsx`의 `masterId` 패턴과 동일).
- 제품명을 바꾸면 버전 선택은 초기화된다.

### 2. 출처 필드 제거

- "출처" 텍스트 입력을 폼에서 삭제한다.
- "출처 유형"(KISA/제조사 라디오)은 그대로 유지한다.
- "출처 URL (선택)" 필드는 그대로 유지한다.

## 폼 상태 (`ManualVulnFormValues`)

변경 전:
```ts
{ cve, title, severity, product: string, source: string, source_url, source_type, notice_type }
```

변경 후:
```ts
{ cve, title, severity, masterId: string, source_url, source_type, notice_type }
```

- `product`(자유 텍스트) → `masterId`(선택된 `sw_masters.id`)로 대체. 제품명 select 값은 파생 상태(`masterId`로부터 역참조하거나, `request-view.tsx`처럼 별도 `productName` 로컬 상태 + `masterId`를 함께 관리)로 다룬다.
- `source` 필드는 폼 상태에서 제거한다 (제출 시점에 계산).

## 제출 로직 (`submitManualVuln`)

`values.masterId`로 `masters`에서 해당 행을 찾아:

- `product`: `` `${master.name} ${master.std_version}` `` (예: "Apache Tomcat 10.1.x")
- `source`: 자동 생성
  - `source_type === "kisa"` → `"KISA 보안공지"`
  - `source_type === "vendor"` → `` `${master.name} 공식 보안 공지` ``

기존 `source_url`, `source_type`, `notice_type`, `severity`, `cve`, `title` 필드는 그대로 유지.

## 검증(제출 가능 조건)

`canSubmit`: `cve`, `title` 비어있지 않음 + `masterId`가 선택됨(= 버전까지 선택 완료). `source`는 더 이상 검증 대상이 아니다(자동 생성이므로 항상 값이 있음).

## 영향받지 않는 부분

- `vulnerabilities` 테이블 스키마, `patch-view.tsx`/`kisa-view.tsx` 등 다른 화면의 `product`/`source` 표시 로직은 변경하지 않는다. 저장되는 문자열 포맷(제품명+버전 결합, 출처 자동 문구)은 기존 자동수집 로직(`app/api/collect-source/route.ts`)의 문구 스타일과 일치시켜 다른 화면에서 이질감이 없도록 한다.
- "자산 EOS 수동 수정" 폼(`ManualEosFormPanel`)은 이번 변경과 무관하며 손대지 않는다.
