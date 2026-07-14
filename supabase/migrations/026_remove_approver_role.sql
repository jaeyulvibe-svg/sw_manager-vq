-- =====================================================
--  "승인자" 역할을 제거하고 관리자로 통합.
--  해커톤 시연 범위에서는 승인 권한을 관리자 한 명에게 몰아준다.
--  기존 "승인자" 사용자(오승인)는 이미 애플리케이션 코드에서
--  role === "관리자"만 승인 액션을 볼 수 있었으므로 사실상
--  이름만 있던 역할이었다 — 데이터를 관리자로 승격하고 값 자체를 제거.
-- =====================================================

update public.app_users
set role = '관리자'
where role = '승인자';

alter table public.app_users drop constraint if exists app_users_role_check;
alter table public.app_users
  add constraint app_users_role_check
  check (role in ('관리자', '담당자', '조회 사용자'));
