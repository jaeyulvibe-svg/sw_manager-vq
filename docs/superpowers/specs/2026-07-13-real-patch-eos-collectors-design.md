# 실제 패치·EOS 수집기 확장 설계

## 배경

지금 `app/api/collect-source/route.ts`에서 "실시간 수집"이라고 부를 수 있는 건 Apache Tomcat과 TmaxSoft(JEUS/WebtoB) 2개 벤더 스크래퍼뿐이다. `CollectProduct` 타입도 `"Apache Tomcat" | "JEUS" | "WebtoB"` 3개로 제한돼 있다(`route.ts:6`). 나머지 5개 SW마스터 제품(OpenSSL, Nginx, Red Hat Enterprise Linux, Oracle Database, PostgreSQL)은 `admin-view.tsx`의 "Source URL 관리" 섹션에 URL·주기·상태가 표시되지만 전부 `SOURCE_SEED_META`(`admin-view.tsx:84-96`)에 하드코딩된 mock 데이터일 뿐 실제 API 호출과 무관하다. KISA(KNVD) 쪽은 수집기 자체가 없고, `source_type` enum 값으로만 존재한다(수동 등록 시에만 선택 가능).

사용자가 외부에서 받은 수집 확장 제안서("GPT가 제안해준 문서")를 검토한 결과, 소스 우선순위·단계적 접근 전략은 타당했지만 구체적인 데이터 모델은 이 코드베이스의 실제 스키마와 맞지 않았다:
- `assets` 테이블 필드명(`product_name`이 아니라 `name`), id 컨벤션(`SW-NNN`)과 다른 신규 필드/포맷을 전제로 함
- CentOS·Ubuntu는 SW마스터 8개 제품에 없는데 새 자산으로 추가하자고 제안함
- 이미 있는 `assets.eos` 필드 대신 별도 EOS 기준 테이블을 새로 만들자고 제안함
- `vulnerabilities`에 `cvss_score`/`references`/`raw_json`/`match_reason`/`recommended_action` 등 다수 신규 컬럼을 요구함 — 문서 스스로 명시한 "큰 구조 변경 금지" 원칙과도 모순

사용자는 **기존 스키마·화면·매칭 로직을 최대한 유지**하면서 실제 수집기만 늘리길 원한다. 이번 작업 범위는 신규 컬렉터 6개(Nginx, PostgreSQL, OpenSSL, Red Hat Enterprise Linux, Oracle Database, KNVD/KISA) 추가이며, 새 테이블·컬럼·화면·매칭 알고리즘 변경은 포함하지 않는다.

## 사전 검증 (실제 fetch로 확인함)

구현 전 6개 소스 URL을 모두 직접 조회해 파싱 가능 여부를 확인했다:

| 제품/소스 | URL | 검증 결과 |
|---|---|---|
| Nginx | `nginx.org/en/security_advisories.html` | HTML `<li><p>` 목록, `CVE 링크`/`Severity: <b>등급</b>`/`Not vulnerable:`/`Vulnerable:` 패턴 확인. Tomcat과 동일 난이도 |
| PostgreSQL (EOS) | `postgresql.org/support/versioning/` | `<table class="table table-striped">`에 버전/최종릴리스일 테이블. PostgreSQL 14 종료일 `2026-11-12` 직접 확인 |
| PostgreSQL (CVE) | `postgresql.org/support/security/` | `<table>`에 CVE/영향 major버전/수정버전/CVSS/설명 컬럼. 깔끔하게 구조화됨 |
| OpenSSL | `openssl-library.org/news/vulnerabilities/index.html` | `<h3 id="CVE-...">` + grid 레이아웃(Severity/Published at/Title/Affected 목록) |
| Red Hat | ~~`access.redhat.com/security/security-updates`~~ | **React SPA로 확인됨 — HTML에 CVE 데이터 없음(순수 스크래핑 불가).** 대신 공식 REST API `access.redhat.com/hydra/rest/securitydata/cve.json`가 정상 동작, JSON으로 CVE/severity/CVSS 반환 확인 |
| Oracle | ~~`oracle.com/security-alerts/`~~ | HTML 테이블은 분기별 CPU 날짜만 나열. 대신 공식 RSS `oracle.com/ocom/groups/public/@otn/documents/webcontent/rss-otn-sec.xml`이 title/link 제공하는 걸 확인, 이걸 사용 |
| KNVD(KISA) | `knvd.krcert.or.kr/rss/security/notice` | 실제 살아있는 RSS(`<item><title>/<link>/<description>`), 정상 응답 확인 |

## 데이터 모델 — 변경 없음

새 테이블·컬럼을 만들지 않는다. 6개 신규 수집기 모두 기존 `vulnerabilities` Row 필드만 채운다: `cve, title, severity, product, source, source_url, source_type, notice_type, mapped_assets: 0, collected_at`.

- `source_type`: Nginx/PostgreSQL/OpenSSL/Red Hat/Oracle → `"vendor"`, **KNVD → `"kisa"`**
- `notice_type`: 개별 CVE 취약점은 `"CVE"`. PostgreSQL 14의 EOS 항목은 `"EOS"`. Oracle 분기별 CPU 공지는 CVE 단위가 아니라 배포 단위 공지이므로 `"Patch"`로 분류
- CVSS 점수는 별도 컬럼으로 저장하지 않고 `severity`(Critical/High/Medium/Low) 산정에만 사용한다 — PostgreSQL 보안 페이지가 CVSS 점수를 직접 주므로 임계값으로 매핑(예: 9.0↑ Critical, 7.0↑ High, 4.0↑ Medium, 그 외 Low), Red Hat API의 `severity` 필드(critical/important/moderate/low)도 동일한 4단계로 매핑
- `assets.eos`(기존 필드), `lib/vuln-match.ts`의 매칭 알고리즘, 4개 리뷰 화면(KISA/제조사/EOS/승인됨) 전부 무변경

## 파일 구조 — 기존 패턴 확장

`app/api/collect-source/route.ts`에 기존 `collectApacheTomcat`/`collectTmaxSoft`와 동일한 패턴으로 함수를 추가한다.

```ts
export type CollectProduct =
  | "Apache Tomcat" | "JEUS" | "WebtoB"
  | "Nginx" | "PostgreSQL" | "OpenSSL" | "Red Hat Enterprise Linux" | "Oracle Database"
  | "KISA"
```

- `collectNginx()`: `nginx.org/en/security_advisories.html`을 cheerio로 파싱해 `<li>`마다 CVE/severity/제목/버전범위 추출. severity 텍스트("major" 등)는 `NGINX_SEVERITY_MAP`으로 Critical/High/Medium/Low에 매핑, 없는 값은 Medium 기본값(Tomcat 패턴과 동일). `notice_type: "CVE"` 고정, `product: "Nginx"`.
- `collectPostgres()`: 두 페이지를 순차 처리.
  - versioning 페이지 테이블에서 `버전=14`인 행을 찾아 최종 릴리스일을 `notice_type: "EOS"` 1건으로 insert(제목: `PostgreSQL 14 지원 종료 안내`, source_url은 versioning 페이지).
  - security 페이지 테이블에서 "영향 major버전" 컬럼에 `14`가 포함된 행만 CVE로 insert(`notice_type: "CVE"`), CVSS 점수를 severity로 매핑.
- `collectOpenSSL()`: `h3[id^='CVE-']` 앵커마다 뒤따르는 grid에서 Severity/Published at/Title/Affected 목록 파싱. `product`는 "Affected" 목록에 있는 버전 범위를 그대로 문자열에 포함(예: `"OpenSSL 3.0.x"`).
- `collectRedHat()`: HTML 스크래핑 대신 공식 REST API를 호출한다. `after` 파라미터는 호출 시점 기준 30일 전 날짜를 `YYYY-MM-DD`로 계산해서 넣는다: `fetch(\`https://access.redhat.com/hydra/rest/securitydata/cve.json?product=Red%20Hat%20Enterprise%20Linux&after=${thirtyDaysAgoIso}\`)`. JSON 배열을 순회해 CVE/severity/공개일 추출. `product: "Red Hat Enterprise Linux"`.
- `collectOracle()`: RSS(`rss-otn-sec.xml`)를 파싱해 최근 항목 title/link를 `notice_type: "Patch"`로 insert. CVE 단위가 아니므로 `cve` 필드에는 "분기 표기"(예: `ORACLE-CPU-2026-06`)를 합성해서 넣는다(TmaxSoft의 `TMAX-{seq}` 패턴과 동일).
- `collectKnvd()`: RSS(`knvd.krcert.or.kr/rss/security/notice`)를 파싱해 각 item의 title/description을 검사, **8개 SW마스터 제품명 중 하나라도 포함된 항목만** insert(그 외엔 KISA 전체 공지가 다 들어와 노이즈가 심해짐). notice_type은 기존 `collectTmaxSoft`와 동일한 제목 키워드 분류(EOL/EOS/단종→EOS, 취약점/보안→CVE, 패치→Patch) 로직을 `lib/notice-classify.ts`(신규, 순수 함수 하나)로 뽑아 `collectTmaxSoft`와 `collectKnvd`가 공유한다 — 로직 중복을 피하기 위한 최소한의 리팩터링. CVE ID는 title/description에서 정규식(`CVE-\d{4}-\d{4,7}`) 추출, 없으면 `KISA-{seq}`. `source_type: "kisa"`, severity는 기본 Medium 고정(NVD 보강은 이번 범위 밖).
- `collectOne()`의 현재 `product === "Apache Tomcat" ? ... : collectTmaxSoft(product)` 삼항 분기를 제품명→함수 매핑 객체로 바꿔 7개 collector를 라우팅한다. `collectKnvd()`는 제품 파라미터를 받지 않으므로 별도 분기.

## 프론트엔드 변경 — admin-view.tsx 최소 수정

- `REAL_COLLECT_PRODUCTS`(`admin-view.tsx:588`)에 6개 값 추가: `["Apache Tomcat","JEUS","WebtoB","Nginx","PostgreSQL","OpenSSL","Red Hat Enterprise Linux","Oracle Database","KISA"]`
- "즉시 수집" 버튼(`runCollection`)의 나머지 로직은 무변경 — 이미 `REAL_COLLECT_PRODUCTS` 배열을 순회해 POST하는 구조라 배열만 늘리면 됨
- Source URL 관리 섹션의 `SOURCE_SEED_META`/`initialSources`는 이번 범위에서 손대지 않는다(여전히 mock 표시 테이블). 이 테이블의 "마지막 수집"/"상태"를 실제 수집 결과와 연동하는 건 후속 작업으로 남긴다.
- KISA는 SW마스터 제품이 아니라 소스 자체이므로 "즉시 수집" 체크박스 목록에 "KISA(KNVD)"라는 별도 항목으로 노출한다(제품 목록과 나란히, 구분되게 표시).

## 매칭 — 전혀 변경하지 않음

`lib/vuln-match.ts`의 `isProductMatch`(제품명 부분 문자열 포함 여부)를 그대로 사용한다. 각 수집기는 `product` 필드에 SW마스터 제품명이 포함된 문자열만 채우면 기존 매칭이 그대로 작동한다. Nginx/OpenSSL의 "Vulnerable: 1.29.4-1.30.0" 같은 버전 범위 정보는 자동 매칭 판단에 쓰지 않고 `title`에 그대로 노출해 승인자가 판단하게 한다(버전 범위 자동 비교는 범위 밖).

## 변경하지 않는 것

- `assets`, `sw_masters` 테이블 스키마 및 시드 데이터(CentOS·Ubuntu 추가 없음)
- `vulnerabilities` 테이블 스키마(신규 컬럼 없음)
- `lib/vuln-match.ts` 매칭 알고리즘
- KISA/제조사/EOS/승인된 취약점 공지 4개 화면, `NoticeReviewBoard`, `useNoticeData`, `notice-actions.ts`
- Source URL 관리 섹션의 mock 표시 방식(연동은 후속 작업)

## 검증 방법

- `pnpm build`/`tsc --noEmit`/`pnpm lint` 클린 확인(이 프로젝트는 `ignoreBuildErrors: true`라 tsc/lint를 별도로 반드시 돌려야 함)
- `pnpm dev`로 관리자 페이지 > 수집 관리에서 "즉시 수집" 눌러 6개 소스 각각 실제 신규 공지가 `vulnerabilities`에 insert되는지 확인
- KNVD로 들어온 공지가 8개 SW마스터 제품 중 하나와 무관하면 insert되지 않는지 확인(노이즈 필터링 동작 검증)
- PostgreSQL 14 EOS 항목이 EOS 공지 화면에, Oracle 분기 공지가 Patch로 제조사 공지 화면에, KNVD 공지가 KISA 공지 화면에 각각 뜨는지 확인 — 기존 4개 화면 라우팅이 새 데이터에도 그대로 작동하는지가 핵심 검증 포인트
- Red Hat API 응답이 비정상(레이트리밋 등)일 때도 다른 5개 수집기가 영향받지 않고 개별 실패로 처리되는지 확인(기존 `collectOne`의 try/catch 패턴 유지)
