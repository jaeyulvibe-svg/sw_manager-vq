-- =====================================================
--  관리자 정책 설정 — 수집 관리 / 승인 정책 탭 실데이터 연동
--  (단일 행, id='default'. 서버 cron이 없어 auto_collect_enabled/
--   collect_interval은 값만 저장하고 실제 주기 실행은 하지 않는다.)
-- =====================================================

create table if not exists public.admin_policies (
  id                      text primary key default 'default',
  auto_collect_enabled    boolean not null default true,
  collect_interval        text not null default '일 1회' check (collect_interval in ('1시간','6시간','일 1회')),
  critical_urgent_alert   boolean not null default true,
  high_requires_approval  boolean not null default true,
  eos_alert_180d          boolean not null default true,
  queue_after_collect     boolean not null default true,
  updated_at              timestamptz not null default now()
);

drop trigger if exists admin_policies_updated_at on public.admin_policies;
create trigger admin_policies_updated_at
  before update on public.admin_policies
  for each row execute function public.set_updated_at();

alter table public.admin_policies enable row level security;

drop policy if exists "allow_all_admin_policies" on public.admin_policies;
create policy "allow_all_admin_policies" on public.admin_policies for all using (true) with check (true);

insert into public.admin_policies (id) values ('default')
on conflict (id) do nothing;
