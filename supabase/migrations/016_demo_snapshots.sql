-- =====================================================
--  DEMO 데이터 스냅샷 — 시연용 샘플 데이터를 기준 상태로
--  저장/복원하기 위한 테이블 + 함수 2개
--  (admin_policies는 운영 설정으로 보고 스냅샷/복원 대상에서 제외)
-- =====================================================

create table if not exists public.demo_snapshots (
  id          text primary key default 'default',
  data        jsonb not null,
  captured_at timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.demo_snapshots enable row level security;

drop policy if exists "allow_all_demo_snapshots" on public.demo_snapshots;
create policy "allow_all_demo_snapshots" on public.demo_snapshots for all using (true) with check (true);

-- ─── 현재 데이터를 기준 스냅샷으로 저장 ───────────────
create or replace function public.save_demo_snapshot()
returns void language plpgsql security definer as $$
begin
  insert into public.demo_snapshots (id, data, captured_at, updated_at)
  values (
    'default',
    jsonb_build_object(
      'servers',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.servers t),
      'sw_masters',      (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sw_masters t),
      'sources',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.sources t),
      'app_users',       (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.app_users t),
      'assets',          (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.assets t),
      'vulnerabilities', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.vulnerabilities t),
      'asset_requests',  (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.asset_requests t),
      'notifications',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.notifications t),
      'notices',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.notices t),
      'licenses',        (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.licenses t),
      'patch_tasks',     (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.patch_tasks t)
    ),
    now(), now()
  )
  on conflict (id) do update set data = excluded.data, updated_at = now();
end;
$$;

grant execute on function public.save_demo_snapshot() to anon, authenticated;

-- ─── 기준 스냅샷으로 복원 ──────────────────────────────
create or replace function public.reset_demo_data()
returns void language plpgsql security definer as $$
declare
  snap jsonb;
begin
  select data into snap from public.demo_snapshots where id = 'default';
  if snap is null then
    raise exception 'demo snapshot not found — call save_demo_snapshot() first';
  end if;

  -- FK로 참조하는 자식 테이블부터 삭제 (licenses/patch_tasks → assets/vulnerabilities, on delete cascade)
  delete from public.patch_tasks;
  delete from public.licenses;
  delete from public.notifications;
  delete from public.asset_requests;
  delete from public.notices;
  delete from public.vulnerabilities;
  delete from public.assets;
  delete from public.servers;
  delete from public.sw_masters;
  delete from public.sources;
  delete from public.app_users;

  -- 참조 대상(부모)부터 복원
  insert into public.servers    select * from jsonb_populate_recordset(null::public.servers,    snap->'servers');
  insert into public.sw_masters select * from jsonb_populate_recordset(null::public.sw_masters,  snap->'sw_masters');
  insert into public.sources    select * from jsonb_populate_recordset(null::public.sources,     snap->'sources');
  insert into public.app_users  select * from jsonb_populate_recordset(null::public.app_users,   snap->'app_users');
  insert into public.assets          select * from jsonb_populate_recordset(null::public.assets,          snap->'assets');
  insert into public.vulnerabilities select * from jsonb_populate_recordset(null::public.vulnerabilities, snap->'vulnerabilities');
  insert into public.asset_requests select * from jsonb_populate_recordset(null::public.asset_requests, snap->'asset_requests');
  insert into public.notifications  select * from jsonb_populate_recordset(null::public.notifications,  snap->'notifications');
  insert into public.notices        select * from jsonb_populate_recordset(null::public.notices,        snap->'notices');
  -- 자식 테이블 마지막
  insert into public.licenses    select * from jsonb_populate_recordset(null::public.licenses,    snap->'licenses');
  insert into public.patch_tasks select * from jsonb_populate_recordset(null::public.patch_tasks, snap->'patch_tasks');
end;
$$;

grant execute on function public.reset_demo_data() to anon, authenticated;

-- ─── 최초 기준 스냅샷 저장: 이 마이그레이션 적용 시점의 현재 데이터를 그대로 기준으로 삼는다 ───
select public.save_demo_snapshot();
