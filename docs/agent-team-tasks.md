# 에이전트 팀 병렬 작업 테스크 묶음

작성일: 2026-07-08

## 현재 마이그레이션 상태

`assets`, `patch`, `kisa`, `asset-dashboard` 뷰는 이미 Supabase 연동 완료. 나머지 페이지는 하드코딩된 mock 배열 상태.

| 상태 | 뷰 |
|---|---|
| Supabase 연동 완료 | `assets-view.tsx`, `patch-view.tsx`, `kisa-view.tsx`, `asset-dashboard-view.tsx` |
| Mock 상태 (마이그레이션 대상) | `request-view.tsx`, `approval-view.tsx`, `notifications-view.tsx`, `dashboard-view.tsx`, `eos-view.tsx`, `admin-view.tsx`, `manual-view.tsx` |

## 병렬 테스크 묶음 (worktree 격리 추천)

### 1. 신규 자산 요청 플로우 마이그레이션
- 대상: `request-view.tsx` + `approval-view.tsx`
- 요청 제출 → 승인이 강하게 결합된 한 쌍이라 같은 에이전트가 맡는 것을 권장
- `requests` 테이블 설계 + RLS 필요

### 2. 알림 센터 마이그레이션
- 대상: `notifications-view.tsx`
- `kisa-view.tsx`가 이미 `notifications` 테이블에 insert하고 있으므로, 해당 테이블을 읽어와 렌더링하도록 연결
- 스키마는 기존 것 재사용

### 3. 대시보드 + EOS 로드맵 마이그레이션
- 대상: `dashboard-view.tsx` + `eos-view.tsx` + `components/dashboard/*` 위젯
- 이미 마이그레이션된 `assets`/`vulnerabilities` 테이블을 집계해 KPI·차트에 연결
- Recharts 위젯이 많아 범위는 크지만 다른 뷰와 파일 충돌 없음

### 4. 관리자 페이지 정리
- 대상: `admin-view.tsx`
- `migration-auditor`가 지목한 "즉시 수집" 등 stale mock 컨트롤 정리 + 필요한 부분만 Supabase 연동
- 범위가 좁아 짧게 끝날 작업

### 5. 크로스커팅 감사 (구현 아님, 리뷰 전용)
- nav/RBAC 동기화(`components/portal/nav.ts`)와 디자인 시스템 일관성(`ui.tsx` 사용 패턴)을 전체 페이지에 걸쳐 점검
- `code-reviewer` 서브에이전트로 나머지 작업이 끝난 뒤 통합 검증용으로 실행 권장

## 실행 방식

1~4는 서로 다른 파일/테이블을 건드리므로 각각 별도 worktree agent로 동시 진행 가능. 5는 나머지가 끝난 뒤 통합 검증용으로 마지막에 실행.
