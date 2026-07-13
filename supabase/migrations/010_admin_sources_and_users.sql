-- =====================================================
--  관리자 페이지 — 공식 Source URL 관리 / 사용자 권한 관리 백엔드
--  (시스템 로그 섹션은 대응 테이블 없이 UI에서 제거됨)
-- =====================================================

-- ─── 공식 Source URL 관리 ─────────────────────────────
create sequence if not exists source_seq start 9; -- 시드 8건(S-001~S-008) 다음부터 발급

create table if not exists public.sources (
  id                text primary key default 'S-' || lpad(nextval('source_seq')::text, 3, '0'),
  name              text not null,
  type              text not null,
  url               text not null,
  cycle             text not null check (cycle in ('1시간','6시간','일 1회')),
  status            text not null default '정상' check (status in ('정상','지연','실패')),
  last_collected_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists sources_updated_at on public.sources;
create trigger sources_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

alter table public.sources enable row level security;

-- 임시 정책: anon 키로 읽기/쓰기 허용 (운영 전 인증 연동 후 축소 필요)
drop policy if exists "allow_all_sources" on public.sources;
create policy "allow_all_sources" on public.sources for all using (true) with check (true);

insert into public.sources (id, name, type, url, cycle, status, last_collected_at) values
  ('S-001', 'Apache Tomcat',            'Vendor Security Advisory', 'tomcat.apache.org/security-10.html',            '6시간',  '정상', now() - interval '1 hour'),
  ('S-002', 'JEUS',                     'Vendor Technical Notice',  'tmaxsoft.com/kr/developer/notice/list',         '일 1회', '정상', now() - interval '1 day'),
  ('S-003', 'WebtoB',                   'Vendor Technical Notice',  'tmaxsoft.com/kr/developer/notice/list',         '일 1회', '정상', now() - interval '2 days'),
  ('S-004', 'Oracle Database',          'Lifecycle Page',           'oracle.com/security-alerts',                    '일 1회', '정상', now() - interval '1 day'),
  ('S-005', 'OpenSSL',                  'Vendor Security Advisory', 'openssl.org/news/vulnerabilities',              '1시간',  '정상', now() - interval '2 hours'),
  ('S-006', 'Nginx',                    'Vendor Security Advisory', 'nginx.org/en/security_advisories.html',         '6시간',  '정상', now() - interval '3 hours'),
  ('S-007', 'Red Hat Enterprise Linux', 'Vendor Security Advisory', 'access.redhat.com/security/security-updates',   '6시간',  '실패', now() - interval '3 days'),
  ('S-008', 'PostgreSQL',               'Vendor Security Advisory', 'postgresql.org/support/security',               '일 1회', '정상', now() - interval '4 hours')
on conflict (id) do nothing;

-- ─── 사용자 권한 관리 ──────────────────────────────────
create sequence if not exists app_user_seq start 5; -- 시드 4건(U-001~U-004) 다음부터 발급

create table if not exists public.app_users (
  id         text primary key default 'U-' || lpad(nextval('app_user_seq')::text, 3, '0'),
  name       text not null,
  email      text not null unique,
  dept       text not null,
  role       text not null check (role in ('관리자','승인자','담당자','조회 사용자')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists app_users_updated_at on public.app_users;
create trigger app_users_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;

drop policy if exists "allow_all_app_users" on public.app_users;
create policy "allow_all_app_users" on public.app_users for all using (true) with check (true);

-- 담당 자산 수는 저장하지 않고 assets.owner를 이름으로 매칭해 화면에서 실시간 계산한다.
insert into public.app_users (id, name, email, dept, role, active) values
  ('U-001', '김관리', 'admin@corp.com', '정보보안팀', '관리자', true),
  ('U-002', '정재율', 'jy.jung@corp.com', '인프라팀', '승인자', true),
  ('U-003', '홍길동', 'gd.hong@corp.com', 'WAS운영팀', '담당자', true),
  ('U-004', '이영희', 'yh.lee@corp.com', 'WEB운영팀', '조회 사용자', false)
on conflict (id) do nothing;
