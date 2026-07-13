-- =====================================================
--  담당자 조치 현황 — 공지 승인 후 자산별 조치 티켓
--  (자산 하나가 여러 공지에 동시에 걸릴 수 있으므로 assets.approval이
--   아니라 이 테이블에서 (공지, 자산) 쌍 단위로 상태를 관리한다)
-- =====================================================

create sequence if not exists public.patch_task_seq;

create table if not exists public.patch_tasks (
  id                text primary key default 'PT-' || lpad(nextval('public.patch_task_seq')::text, 3, '0'),
  vulnerability_id  uuid not null references public.vulnerabilities(id) on delete cascade,
  asset_id          text not null references public.assets(id) on delete cascade,
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

drop trigger if exists patch_tasks_updated_at on public.patch_tasks;
create trigger patch_tasks_updated_at
  before update on public.patch_tasks
  for each row execute function public.set_updated_at();

alter table public.patch_tasks enable row level security;

drop policy if exists "allow_all_patch_tasks" on public.patch_tasks;
create policy "allow_all_patch_tasks" on public.patch_tasks for all using (true) with check (true);
