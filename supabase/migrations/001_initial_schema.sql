-- =====================================================
--  AI SW Asset Master — Initial Schema
-- =====================================================

-- ─── 시퀀스 먼저 생성 ────────────────────────────────
create sequence if not exists assets_seq  start 1;
create sequence if not exists request_seq start 1;

-- ─── 자산 목록 ─────────────────────────────────────
create table if not exists public.assets (
  id          text primary key default 'SW-' || lpad(nextval('assets_seq')::text, 3, '0'),
  name        text not null,
  vendor      text not null,
  category    text not null check (category in ('OS','WEB','WAS','DB','Middleware','Security')),
  version     text not null,
  latest_version text,
  server      text not null,
  owner       text not null,
  vuln        text not null default 'Low' check (vuln in ('Critical','High','Medium','Low')),
  patch       text not null default 'Up to Date' check (patch in ('Patch Required','Up to Date','Patch Available')),
  eos         date,
  approval    text not null default '승인대기' check (approval in ('승인대기','확인필요','승인완료','긴급')),
  checked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── 취약점 공지 (CVE / KISA) ────────────────────────
create table if not exists public.vulnerabilities (
  id            uuid primary key default gen_random_uuid(),
  cve           text not null,
  title         text not null,
  severity      text not null check (severity in ('Critical','High','Medium','Low')),
  product       text not null,
  source        text not null,
  source_url    text,
  mapped_assets int  not null default 0,
  approval      text not null default '승인대기' check (approval in ('승인대기','검토중','승인완료','반려')),
  collected_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- ─── 신규 자산 요청 ─────────────────────────────────
create table if not exists public.asset_requests (
  id             uuid primary key default gen_random_uuid(),
  no             text unique not null default 'REQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('request_seq')::text, 3, '0'),
  name           text not null,
  vendor         text not null,
  version        text not null,
  category       text not null,
  server         text not null,
  owner          text not null,
  reason         text not null,
  requester      text not null,
  requester_dept text not null,
  approval       text not null default '승인대기' check (approval in ('승인대기','검토중','승인완료','반려')),
  urgency        text not null default '일반' check (urgency in ('일반','긴급')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─── 알림 ────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('asset','security','system')),
  title       text not null,
  description text not null,
  asset       text not null,
  owner       text not null,
  status      text not null default '확인필요' check (status in ('확인필요','승인대기','검토중','완료','긴급')),
  urgent      boolean not null default false,
  read        boolean not null default false,
  link_view   text not null,
  link_label  text not null,
  created_at  timestamptz not null default now()
);

-- ─── 공지사항 ─────────────────────────────────────────
create table if not exists public.notices (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  title      text not null,
  author     text not null,
  status     text not null default '일반' check (status in ('일반','중요','긴급')),
  views      int  not null default 0,
  created_at timestamptz not null default now()
);

-- ─── updated_at 자동 갱신 트리거 ─────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger assets_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

create trigger asset_requests_updated_at
  before update on public.asset_requests
  for each row execute function public.set_updated_at();

-- ─── RLS (Row Level Security) ─────────────────────────
alter table public.assets           enable row level security;
alter table public.vulnerabilities  enable row level security;
alter table public.asset_requests   enable row level security;
alter table public.notifications    enable row level security;
alter table public.notices          enable row level security;

-- 임시 정책: anon 키로 읽기/쓰기 허용 (운영 전 인증 연동 후 축소 필요)
create policy "allow_all_assets"          on public.assets           for all using (true) with check (true);
create policy "allow_all_vulnerabilities" on public.vulnerabilities  for all using (true) with check (true);
create policy "allow_all_requests"        on public.asset_requests   for all using (true) with check (true);
create policy "allow_all_notifications"   on public.notifications    for all using (true) with check (true);
create policy "allow_all_notices"         on public.notices          for all using (true) with check (true);
