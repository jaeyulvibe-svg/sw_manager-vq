-- =====================================================
--  019 적용 직후 관리자가 "즉시 수집"으로 RHEL CVE를 30건
--  실제 스크래핑해 vulnerabilities/patch_tasks/notifications가
--  오염됨. DEMO 기준(vulnerabilities 7건)에 없던 RHEL 자동수집분을
--  전부 제거하고 sources.S-006 상태를 원래 기준으로 되돌린 뒤
--  스냅샷을 다시 저장한다.
-- =====================================================

-- DEMO 기준 patch_tasks/notifications 7·4건 중 owner='박인프라'인 행은 없음(스펙 참고).
-- RHEL 자동수집 오염분은 전부 박인프라(RHEL 담당자) 앞으로 생성됐으므로 owner 기준으로 제거.
delete from public.patch_tasks where owner = '박인프라';
delete from public.notifications where owner = '박인프라';
delete from public.vulnerabilities where source = 'Red Hat Security Data API';

update public.sources
set status = '실패', last_collected_at = now() - interval '3 days'
where id = 'S-006';

-- ─── 정리 후 최종 카운트 확인 (수동 점검용, 결과는 무시됨) ───
select
  (select count(*) from public.vulnerabilities) as vuln_count,
  (select count(*) from public.patch_tasks) as patch_task_count,
  (select count(*) from public.notifications) as notif_count;

-- ─── 기준 스냅샷 재저장 ─────────────────────────────
select public.save_demo_snapshot();
