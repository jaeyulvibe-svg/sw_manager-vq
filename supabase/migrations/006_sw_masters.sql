-- =====================================================
--  SW 마스터 관리 — 편집형 데이터 그리드 백엔드
-- =====================================================

create sequence if not exists master_seq start 9; -- 시드 8건(M-001~M-008) 다음부터 발급

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

-- 삭제되지 않은 행 중 제품명+벤더+표준버전 조합은 유일해야 함 (중복 등록 방지)
create unique index if not exists sw_masters_dedup
  on public.sw_masters (name, vendor, std_version)
  where deleted_at is null;

alter table public.sw_masters enable row level security;

-- 임시 정책: anon 키로 읽기/쓰기 허용 (운영 전 인증 연동 후 축소 필요)
create policy "allow_all_sw_masters" on public.sw_masters for all using (true) with check (true);

-- ─── 시드 데이터 (기존 SW 마스터 관리 mock 8건과 동일) ───
insert into public.sw_masters (id, name, vendor, category, std_version, collect_mode, active, manager) values
  ('M-001', 'Apache Tomcat',             'Apache',           'WAS',        '10.1.24', 'AUTO',      true, '홍길동'),
  ('M-002', 'JEUS',                      'TmaxSoft',         'WAS',        '8.5',     'MANUAL',    true, '김철수'),
  ('M-003', 'WebtoB',                    'TmaxSoft',         'WEB',        '6.0',     'SEMI_AUTO', true, '이영희'),
  ('M-004', 'Oracle Database',           'Oracle',           'DB',         '23c',     'SEMI_AUTO', true, '박민수'),
  ('M-005', 'OpenSSL',                   'OpenSSL Project',  'Security',   '3.3.1',   'AUTO',      true, '정재율'),
  ('M-006', 'Nginx',                     'F5',               'WEB',        '1.27',    'AUTO',      true, '이영희'),
  ('M-007', 'Red Hat Enterprise Linux',  'Red Hat',          'OS',         '9.4',     'SEMI_AUTO', true, '인프라팀'),
  ('M-008', 'PostgreSQL',                'PostgreSQL GDG',   'DB',         '16.3',    'AUTO',      true, '김철수');
