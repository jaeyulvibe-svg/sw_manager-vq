# 담당자 조치 현황(patch_tasks) 설계

## 배경

공지 승인 → 자산 매칭 → 담당자 알림까지는 구현되어 있지만(`lib/notice-approval.ts`), 담당자가 알림을 받은 뒤 "언제까지 조치할지", "왜 즉시 반영이 어려운지" 같은 후속 피드백을 남길 곳이 없다. 알림 화면(`notifications-view.tsx`)은 읽음 처리와 화면 이동만 지원한다.

이 문서는 자산별 조치 티켓을 저장하는 `patch_tasks` 테이블과, 담당자가 계획/지연사유/완료를 등록하는 신규 화면("내 조치 업무")을 정의한다. 예외요청·승인, 증적 첨부, 담당자 변경, 관리자 완료 확인은 2차로 미룬다.

## 데이터 모델 — `patch_tasks` (신규 테이블)

```sql
create sequence patch_task_seq;

create table patch_tasks (
  id                text primary key default 'PT-' || lpad(nextval('patch_task_seq')::text, 3, '0'),
  vulnerability_id  text not null references vulnerabilities(id) on delete cascade,
  asset_id          text not null references assets(id) on delete cascade,
  owner             text not null,
  status            text not null default '배정됨'
                      check (status in ('배정됨','조치예정','조치지연','조치완료')),
  due_date          date,
  note              text,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (vulnerability_id, asset_id)
);
```

- `owner`는 생성 시점 `assets.owner` 값을 스냅샷으로 복사한다(자산의 담당자가 나중에 바뀌어도 이미 배정된 티켓은 원래 담당자 이름으로 남는다 — 1차 스코프에서는 담당자 재배정 기능이 없으므로 자연스러운 동작).
- `vulnerabilities`/`assets`의 제목·CVE·심각도·제품명·서버명 등은 저장하지 않는다. 화면에서 `vulnerability_id`/`asset_id`로 두 테이블을 조회해 클라이언트에서 매칭한다 — `use-notice-data.ts`의 `matchMap` 패턴과 동일.
- `(vulnerability_id, asset_id)` unique 제약으로 같은 자산에 같은 공지 티켓이 중복 생성되지 않게 한다.
- `assets.approval`, `notifications.status`의 기존 enum은 그대로 둔다. 자산 하나가 여러 공지에 동시에 걸릴 수 있으므로(자산 1 : 공지 N) 상태는 자산이 아니라 `patch_tasks` 행 단위로 관리한다.

### 상태값

- `배정됨` — 티켓 생성 직후 기본값. 담당자가 아직 아무 것도 입력하지 않은 상태.
- `조치예정` — 담당자가 `due_date` + `note`(조치 계획)를 입력.
- `조치지연` — 담당자가 `due_date`(예상 조치일) + `note`(지연 사유)를 입력. 필드는 `조치예정`과 동일하게 재사용하고 상태값으로만 구분한다.
- `조치완료` — 담당자가 완료를 등록. `completed_at`을 현재 시각으로 채우고 `note`에 조치 내용을 남길 수 있다.

## 자동 생성 흐름

`lib/notice-approval.ts`의 `flagMatchedAssetsAndNotify()`에 아래 로직을 추가한다(기존 자산 플래그 + 알림 insert 로직 뒤):

```ts
if (matched.length > 0) {
  await supabase.from("patch_tasks").upsert(
    matched.map((a) => ({
      vulnerability_id: vulnerabilityId, // 호출부에서 v.id를 함께 전달하도록 시그니처 확장
      asset_id: a.id,
      owner: a.owner,
    })),
    { onConflict: "vulnerability_id,asset_id", ignoreDuplicates: true },
  )
}
```

- `flagMatchedAssetsAndNotify`는 현재 `vulnerability_id`를 받지 않으므로(제목/CVE/심각도/공지유형만 받음) 인자 타입(`Pick<Vulnerability, ...>`)에 `"id"`를 추가한다.
  - `applyNoticeApproval`(수동 승인)은 이미 실제 DB 행(`v: Tables<"vulnerabilities">`)을 다루므로 `v.id`가 그대로 있어 수정이 필요 없다.
  - `collect-source/route.ts`의 `collectOne`은 다르다 — 현재 `supabase.from("vulnerabilities").insert(prepared.map(...))`가 `.select()` 없이 호출되어 생성된 `id`를 돌려받지 않는다. `insert(...).select("id, cve")`로 바꿔 삽입된 행을 돌려받고, `cve`(유니크)로 매칭해 `flagMatchedAssetsAndNotify` 호출 시 `{ ...notice, id }`를 넘기도록 고친다.
- 수동 승인(`notice-actions.ts` → 브라우저 클라이언트)과 자동 수집 승인(`app/api/collect-source/route.ts` → 서비스 롤 클라이언트) 두 경로 모두 이 함수를 공유하므로 별도 분기 없이 동일하게 적용된다.
- 티켓 생성 자체로는 새 알림을 만들지 않는다. 기존 "패치 필요" 알림 1건이면 충분하고, 완료/지연 시 관리자 알림은 2차 스코프.

## 신규 화면 — `patch-tasks` ("내 조치 업무")

### 내비게이션

`components/portal/nav.ts`:
- `ViewKey`에 `"patch-tasks"` 추가.
- `vuln-notice` 그룹의 `children`에 `patch` 다음 항목으로 `{ key: "patch-tasks", label: "내 조치 업무", icon: ListChecks }` 추가. `adminOnly`/`userOnly` 플래그 없음 — 두 역할 모두 접근 가능(같은 화면을 공유하고 컴포넌트 내부에서 `isAdmin`으로 분기).

### 데이터 로딩

새 훅 `use-patch-tasks.ts` (`use-notice-data.ts`와 같은 위치, `components/pages/patch-board/`에 신설):
- `patch_tasks`, `vulnerabilities`, `assets`를 병렬 조회.
- 세 테이블을 join한 뷰모델 `{ task, vulnerability, asset }[]`을 반환(클라이언트에서 `Map`으로 조인 — `matchMap`과 동일한 스타일).
- `refresh()` 제공(등록 후 재조회).

### 화면 구성

- `PageHeader` (`title: "내 조치 업무"`, 아이콘 `ListChecks`).
- 상단 요약 카드 4개: 전체 배정, 조치예정, 조치지연, 조치완료 (`StatCard`, 기존 `patch-view.tsx` 상단 카드와 동일한 스타일).
- 필터 바 (기존 `patch-view.tsx`/`notice-review-board.tsx` 필터 UI 재사용):
  - 상태 (전체/배정됨/조치예정/조치지연/조치완료)
  - 심각도 (전체/Critical/High/Medium/Low)
  - **담당자** — `app_users`에서 `role = '담당자' && active = true`인 사용자 이름을 조회한 드롭다운. 기본값 "전체".
    - 실제 로그인이 없으므로(`role-context.tsx`가 관리자/담당자 역할만 토글) 이 드롭다운으로 "나"를 선택하는 방식으로 담당자 신원을 시뮬레이션한다.
    - `isAdmin`이면 기본값 "전체"로 전체 현황을 봄.
    - `!isAdmin`(담당자 역할)이면 이름을 선택해야 자신의 행에 "조치 등록" 버튼이 활성화된다(아래).
- 테이블 (`TableShell`): 심각도, CVE/EOS, 제품명, 서버명, 담당자, 상태, 기한, 메모, 관리(액션) 컬럼.
- 행별 액션:
  - `!isAdmin`이고 현재 선택된 담당자 필터 값이 그 행의 `owner`와 일치할 때만 "조치 등록" `MiniButton` 노출.
  - 클릭 시 인라인 편집 패널(assets-view.tsx의 즉시반영 편집 패널과 동일 UX) 오픈: 상태 셀렉트(조치예정/조치지연/조치완료) + 기한(date input) + 메모(textarea).
  - 저장 시 `supabase.from("patch_tasks").update({ status, due_date, note, completed_at: status === "조치완료" ? now : null, updated_at: now }).eq("id", task.id)` → 목록 갱신 + 토스트.
  - `isAdmin`은 1차 스코프에서 이 화면에서 액션 없음(조회 전용).

## `patch-view.tsx` (승인된 취약점 공지) 소소한 추가

- "매핑 자산" 펼침 목록의 각 자산 옆에 조치 상태 배지 1개 추가. 이미 `matchMap`으로 자산을 fetch하고 있으므로, `patch_tasks`를 추가로 조회해 `(vulnerability_id, asset_id)` 기준으로 상태만 조인해서 표시한다(별도 화면 이동 없이 한눈에 보이는 용도).
- `PageHeader`의 액션 버튼 줄에 "내 조치 업무 바로가기" `MiniButton` 추가(`onNavigate("patch-tasks")`).

## 파일 변경 범위

- `supabase/migrations/015_patch_tasks.sql` (신규)
- `lib/supabase/types.ts` (`patch_tasks` 테이블 타입 추가)
- `lib/notice-approval.ts` (`flagMatchedAssetsAndNotify` 시그니처에 `vulnerability_id` 추가 + `patch_tasks` upsert)
- `app/api/collect-source/route.ts` / `components/pages/notice-board/notice-actions.ts` (호출부에서 `id` 전달 — 이미 갖고 있는 값이므로 최소 수정)
- `components/portal/nav.ts` (`ViewKey`, `NAV_ITEMS`에 `patch-tasks` 추가)
- `components/pages/patch-board/use-patch-tasks.ts` (신규 훅)
- `components/pages/patch-tasks-view.tsx` (신규 화면)
- `components/pages/patch-view.tsx` (상태 배지 + 바로가기 버튼 추가)
- `app/page.tsx` (`renderView()`에 `"patch-tasks"` 분기 추가)

## 2차로 미루는 것

예외요청/예외승인, 담당자 변경, 관리자 완료 확인, 증적 URL, 조치계획/지연사유/완료내용을 위한 별도 컬럼 분리, 완료·지연 등록 시 관리자 알림 생성.

## 테스트 계획

테스트 스위트가 없는 프로젝트이므로 수동 검증으로 갈음한다:
- KISA/제조사/EOS 공지 승인(자산 매칭 있는 건) → `patch_tasks`에 매칭 자산 수만큼 행이 `배정됨` 상태로 생성되는지 확인.
- 같은 공지를 다시 승인 시도(버튼이 이미 숨겨지므로 실제로는 재현 어려움 — 코드 레벨에서 upsert `ignoreDuplicates` 동작만 확인)해도 중복 생성되지 않는지 확인.
- `/api/collect-source`로 자동 승인되는 공지(정책 OFF 상태) → 같은 방식으로 `patch_tasks` 생성 확인.
- "내 조치 업무" 화면에서 담당자 필터로 이름 선택 → 본인 행에만 "조치 등록" 버튼 활성화 확인.
- 조치예정/조치지연/조치완료 등록 → 새로고침 후 상태·기한·메모 유지 확인, 요약 카드 숫자 갱신 확인.
- 관리자 역할에서는 전체 목록이 보이고 액션 버튼이 없는지 확인.
- `patch-view.tsx` 매핑 자산 펼침 목록에 상태 배지가 뜨는지, "내 조치 업무 바로가기" 버튼이 정상 이동하는지 확인.
