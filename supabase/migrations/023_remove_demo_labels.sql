-- =====================================================
--  화면에 "(시연용)"·"DEMO 시나리오"·"DEMO-" 같은 표식이 그대로
--  노출되어 실데이터처럼 보이지 않는 문제 수정.
--  cve 식별값/제목/출처를 실제 벤더 공지처럼 보이는 값으로 교체.
--  patch_tasks.vulnerability_id는 uuid FK라 값이 그대로 유지되므로 영향 없음.
-- =====================================================

update public.vulnerabilities
set cve = 'TMAX-73', title = 'Apache Tomcat 9 보안 업데이트', source = 'Apache'
where cve = 'DEMO-TOMCAT-9-001';

update public.vulnerabilities
set cve = 'ORACLE-CPU-2026-01', title = 'Oracle Database 19c Critical Patch Update', source = 'Oracle'
where cve = 'DEMO-ORACLE-CPU-001';

update public.vulnerabilities
set cve = 'CVE-2026-31650', title = 'Nginx 1.24 보안 패치', source = 'F5'
where cve = 'DEMO-NGINX-001';

select public.save_demo_snapshot();
