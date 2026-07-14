-- =====================================================
--  TmaxSoft 제품(JEUS, WebtoB) 완전 제거
--  EOS 날짜를 실제로 수집해오기 어려워 데모 대상에서 제외한다.
--  patch_tasks/licenses는 assets/vulnerabilities에 on delete cascade로
--  걸려 있으므로 관련 행이 자동으로 함께 정리된다.
-- =====================================================

delete from public.assets where name in ('JEUS', 'WebtoB');
delete from public.vulnerabilities where product in ('JEUS', 'WebtoB');
delete from public.sources where name in ('JEUS', 'WebtoB');
delete from public.sw_masters where name in ('JEUS', 'WebtoB');

-- 이 마이그레이션 적용 시점의 (TMAX 제거된) 현재 데이터를 새 DEMO 기준 스냅샷으로 저장 —
-- 이후 "DEMO 데이터 설정" 화면의 "초기화"를 눌러도 TMAX가 다시 나타나지 않는다.
select public.save_demo_snapshot();
