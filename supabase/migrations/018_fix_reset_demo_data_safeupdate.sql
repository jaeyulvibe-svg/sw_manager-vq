-- =====================================================
--  reset_demo_data() 수정 — Supabase의 pg-safeupdate 확장이
--  WHERE 절 없는 DELETE를 막아서 "DELETE requires a WHERE clause"
--  에러가 발생함. 모든 DELETE에 where true를 붙여 우회.
-- =====================================================

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
  delete from public.patch_tasks where true;
  delete from public.licenses where true;
  delete from public.notifications where true;
  delete from public.asset_requests where true;
  delete from public.notices where true;
  delete from public.vulnerabilities where true;
  delete from public.assets where true;
  delete from public.servers where true;
  delete from public.sw_masters where true;
  delete from public.sources where true;
  delete from public.app_users where true;

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
