-- =====================================================
--  019/020 이후에도 관리자 페이지에서 "즉시 수집"을 반복 실행해
--  vulnerabilities/patch_tasks/notifications가 계속 오염됨.
--  이번엔 화이트리스트(DEMO 기준 7개 cve) 방식으로 확실히 정리하고
--  스냅샷을 다시 저장한다. 수집은 이제 중단된 상태에서 실행.
-- =====================================================

delete from public.patch_tasks
where vulnerability_id not in (
  select id from public.vulnerabilities where cve in (
    'TMAX-71','TMAX-72','CVE-2026-55956','DEMO-TOMCAT-9-001',
    'DEMO-ORACLE-CPU-001','DEMO-NGINX-001','TMAX-EOS-JEUS7'
  )
);

delete from public.notifications where owner = '박인프라';

delete from public.vulnerabilities
where cve not in (
  'TMAX-71','TMAX-72','CVE-2026-55956','DEMO-TOMCAT-9-001',
  'DEMO-ORACLE-CPU-001','DEMO-NGINX-001','TMAX-EOS-JEUS7'
);

update public.sources
set status = '실패', last_collected_at = now() - interval '3 days'
where id = 'S-006';

-- ─── 최종 카운트 확인 (수동 점검용) ───
select
  (select count(*) from public.vulnerabilities) as vuln_count,
  (select count(*) from public.patch_tasks) as patch_task_count,
  (select count(*) from public.notifications) as notif_count;

select public.save_demo_snapshot();
