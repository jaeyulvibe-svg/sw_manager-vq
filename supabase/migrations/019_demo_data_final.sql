-- =====================================================
--  DEMO 샘플 데이터 최종 확정
--  servers는 유지, 나머지 10개 테이블은 정리 후 재입력.
--  마지막에 save_demo_snapshot()으로 새 기준 스냅샷 저장.
-- =====================================================

-- ─── 1. 기존 데이터 정리 (FK 자식 → 부모 순) ───────────
delete from public.patch_tasks where true;
delete from public.asset_requests where true;
delete from public.notifications where true;
delete from public.licenses where true;
delete from public.vulnerabilities where true;
delete from public.notices where true;
delete from public.assets where true;
delete from public.sw_masters where true;
delete from public.sources where true;
delete from public.app_users where true;

-- ─── 2. app_users (8명) ─────────────────────────────
-- email은 NOT NULL UNIQUE라 내부 저장용 값만 생성, 화면/보고에 노출 안 함
insert into public.app_users (id, name, email, dept, role, active) values
  ('U-001', '정재율', 'u001@demo.internal', '시스템관리팀', '관리자', true),
  ('U-002', '오승인', 'u002@demo.internal', '정보보안팀', '승인자', true),
  ('U-003', '박인프라', 'u003@demo.internal', '인프라운영팀', '담당자', true),
  ('U-004', '이와스', 'u004@demo.internal', 'WAS운영팀', '담당자', true),
  ('U-005', '최웹', 'u005@demo.internal', 'WEB운영팀', '담당자', true),
  ('U-006', '김디비', 'u006@demo.internal', 'DB운영팀', '담당자', true),
  ('U-007', '서보안', 'u007@demo.internal', '정보보안팀', '담당자', true),
  ('U-008', '한조회', 'u008@demo.internal', 'IT기획팀', '조회 사용자', true);
select setval('app_user_seq', 8, true);

-- ─── 3. sw_masters (7개) ────────────────────────────
insert into public.sw_masters (id, name, vendor, category, std_version, active) values
  ('M-001', 'Red Hat Enterprise Linux', 'Red Hat', 'OS', '9.6', true),
  ('M-002', 'Apache Tomcat', 'Apache', 'WAS', '10.1.57', true),
  ('M-003', 'JEUS', 'TmaxSoft', 'WAS', '9.0', true),
  ('M-004', 'WebtoB', 'TmaxSoft', 'WEB', '5.0 SP0 Fix4 B396', true),
  ('M-005', 'Nginx', 'F5', 'WEB', '1.27.x', true),
  ('M-006', 'Oracle Database', 'Oracle', 'DB', '23ai', true),
  ('M-007', 'PostgreSQL', 'PostgreSQL GDG', 'DB', '16 최신 패치', true);
select setval('master_seq', 7, true);

-- ─── 4. sources (7개) — 기존 공식 URL 재사용, https:// 포함 ──
insert into public.sources (id, name, type, url, cycle, status, last_collected_at) values
  ('S-001', 'Apache Tomcat',            'Vendor Security Advisory', 'https://tomcat.apache.org/security-10.html',          '6시간',  '정상', now() - interval '1 hour'),
  ('S-002', 'JEUS',                     'Vendor Technical Notice',  'https://tmaxsoft.com/kr/developer/notice/list',       '일 1회', '정상', now() - interval '1 day'),
  ('S-003', 'WebtoB',                   'Vendor Technical Notice',  'https://tmaxsoft.com/kr/developer/notice/list',       '일 1회', '정상', now() - interval '2 days'),
  ('S-004', 'Oracle Database',          'Lifecycle Page',           'https://oracle.com/security-alerts',                  '일 1회', '지연', now() - interval '3 days'),
  ('S-005', 'Nginx',                    'Vendor Security Advisory', 'https://nginx.org/en/security_advisories.html',       '6시간',  '정상', now() - interval '3 hours'),
  ('S-006', 'Red Hat Enterprise Linux', 'Vendor Security Advisory', 'https://access.redhat.com/security/security-updates', '6시간',  '실패', now() - interval '3 days'),
  ('S-007', 'PostgreSQL',               'Vendor Security Advisory', 'https://postgresql.org/support/security',             '일 1회', '정상', now() - interval '4 hours');
select setval('source_seq', 7, true);

-- ─── 5. assets (16개) ───────────────────────────────
-- 서버 매핑(실제 servers 테이블 기준, GPT 스펙의 가상 서버명 대신 실서버 사용):
--   WAS-PRD-01→SVR-001, WAS-PRD-02→SVR-002, WEB-PRD-01→SVR-003, WEB-PRD-02→SVR-004,
--   DB-PRD-01→SVR-005, DB-PRD-03→SVR-006, SEC-PRD-01→SVR-007, OS-PRD-04→SVR-008
insert into public.assets (id, name, vendor, category, version, latest_version, server, owner, vuln, patch, eos, approval) values
  ('SW-001', 'Red Hat Enterprise Linux', 'Red Hat',        'OS',  '8.8',                     '9.6',                     'SVR-001', '박인프라', 'Medium',   'Patch Available', current_date + 1095, '승인완료'),
  ('SW-002', 'JEUS',                     'TmaxSoft',       'WAS', '7.0',                     '9.0',                     'SVR-001', '이와스',   'Critical', 'Patch Required',  current_date - 180,  '긴급'),
  ('SW-003', 'Apache Tomcat',            'Apache',         'WAS', '9.0.89',                  '9.0 최신 패치',           'SVR-001', '이와스',   'High',     'Patch Required',  current_date + 120,  '확인필요'),
  ('SW-004', 'Red Hat Enterprise Linux', 'Red Hat',        'OS',  '9.4',                     '9.6',                     'SVR-002', '박인프라', 'Low',      'Up to Date',      current_date + 1095, '승인완료'),
  ('SW-005', 'JEUS',                     'TmaxSoft',       'WAS', '9.0',                     '9.0',                     'SVR-002', '이와스',   'Low',      'Up to Date',      null,                 '승인완료'),
  ('SW-006', 'Apache Tomcat',            'Apache',         'WAS', '10.1.20',                 '10.1.57',                 'SVR-002', '이와스',   'Medium',   'Patch Required',  current_date + 730,  '승인완료'),
  ('SW-007', 'Red Hat Enterprise Linux', 'Red Hat',        'OS',  '8.8',                     '9.6',                     'SVR-003', '박인프라', 'Medium',   'Patch Available', current_date + 1095, '승인완료'),
  ('SW-008', 'WebtoB',                   'TmaxSoft',       'WEB', '5.0 SP0 Fix4 B395',       '5.0 SP0 Fix4 B396',       'SVR-003', '최웹',     'High',     'Patch Available', current_date + 120,  '확인필요'),
  ('SW-009', 'Red Hat Enterprise Linux', 'Red Hat',        'OS',  '9.4',                     '9.6',                     'SVR-004', '박인프라', 'Low',      'Up to Date',      current_date + 1095, '승인완료'),
  ('SW-010', 'Nginx',                    'F5',             'WEB', '1.24.0',                  '1.27.x',                 'SVR-004', '최웹',     'Medium',   'Patch Available', current_date + 60,   '확인필요'),
  ('SW-011', 'Red Hat Enterprise Linux', 'Red Hat',        'OS',  '8.8',                     '9.6',                     'SVR-005', '박인프라', 'Medium',   'Patch Available', current_date + 1095, '승인완료'),
  ('SW-012', 'Oracle Database',          'Oracle',         'DB',  '19c',                     '23ai',                    'SVR-005', '김디비',   'Critical', 'Patch Required',  current_date + 240,  '승인대기'),
  ('SW-013', 'Red Hat Enterprise Linux', 'Red Hat',        'OS',  '9.4',                     '9.6',                     'SVR-006', '박인프라', 'Low',      'Up to Date',      current_date + 1095, '승인완료'),
  ('SW-014', 'PostgreSQL',               'PostgreSQL GDG', 'DB',  '16.2',                    '16 최신 패치',            'SVR-006', '김디비',   'High',     'Patch Available', current_date + 730,  '승인완료'),
  ('SW-015', 'Red Hat Enterprise Linux', 'Red Hat',        'OS',  '9.4',                     '9.6',                     'SVR-007', '박인프라', 'Low',      'Up to Date',      current_date + 1095, '승인완료'),
  ('SW-016', 'Red Hat Enterprise Linux', 'Red Hat',        'OS',  '7.9',                     '9.6',                     'SVR-008', '박인프라', 'High',     'Patch Required',  current_date - 180,  '승인완료');
select setval('assets_seq', 16, true);

-- ─── 6. vulnerabilities (7건) ───────────────────────
-- id는 uuid 자동생성, cve 컬럼에 스펙의 식별값을 저장. mapped_assets는 실제 매칭 자산 수.
insert into public.vulnerabilities (cve, title, severity, product, source, source_url, source_type, mapped_assets, approval, notice_type) values
  ('TMAX-71',            'JEUS 7~9 원격 코드 실행 취약점',                     'Critical', 'JEUS',            'TmaxSoft',      'https://tmaxsoft.com/kr/developer/notice/list', 'vendor', 2, '승인대기', 'CVE'),
  ('TMAX-72',            'WebtoB 5 보안 취약점',                               'High',     'WebtoB',          'TmaxSoft',      'https://tmaxsoft.com/kr/developer/notice/list', 'vendor', 1, '승인완료', 'CVE'),
  ('CVE-2026-55956',     'Apache Tomcat 10.1 취약점',                          'Medium',   'Apache Tomcat',   'Apache',        'https://tomcat.apache.org/security-10.html',    'vendor', 1, '승인대기', 'CVE'),
  ('DEMO-TOMCAT-9-001',  'Apache Tomcat 9 보안 업데이트 (시연용)',             'High',     'Apache Tomcat',   'DEMO 시나리오', null,                                             'vendor', 1, '승인완료', 'CVE'),
  ('DEMO-ORACLE-CPU-001','Oracle Database 19c Critical Patch Update (시연용)', 'Critical', 'Oracle Database', 'DEMO 시나리오', null,                                             'vendor', 1, '승인완료', 'Patch'),
  ('DEMO-NGINX-001',     'Nginx 1.24 보안 패치 (시연용)',                      'Medium',   'Nginx',           'DEMO 시나리오', null,                                             'vendor', 1, '승인완료', 'CVE'),
  ('TMAX-EOS-JEUS7',     'JEUS 7 지원종료(EOS) 안내',                          'High',     'JEUS',            'TmaxSoft',      'https://tmaxsoft.com/kr/developer/notice/list', 'vendor', 1, '승인완료', 'EOS');

-- ─── 7. asset_requests (4건) ────────────────────────
insert into public.asset_requests (no, name, vendor, version, category, server, owner, reason, requester, requester_dept, approval, urgency) values
  ('REQ-2026-001', 'PostgreSQL',               'PostgreSQL GDG', '17.0',    'DB',  'SVR-005', '김디비',   '신규 분석 서비스 구축을 위한 PostgreSQL 17 데이터베이스 도입', '한조회',   'IT기획팀',    '승인대기', '일반'),
  ('REQ-2026-002', 'Apache Tomcat',            'Apache',         '10.1.57', 'WAS', 'SVR-002', '이와스',   'WAS 신규 서비스용 Tomcat 10 도입',                             '이와스',   'WAS운영팀',   '검토중',   '일반'),
  ('REQ-2026-003', 'Nginx',                    'F5',             '1.27.x',  'WEB', 'SVR-004', '최웹',     '기존 Nginx 버전 업그레이드',                                    '최웹',     'WEB운영팀',   '승인완료', '일반'),
  ('REQ-2026-004', 'Red Hat Enterprise Linux', 'Red Hat',        '9.6',     'OS',  'SVR-008', '박인프라', 'OS 표준 버전 정비',                                             '박인프라', '인프라운영팀','반려',     '긴급');
select setval('request_seq', 4, true);

-- ─── 8. licenses (4건, assets 이후 — asset_id FK) ───
insert into public.licenses (asset_id, total_seats, used_seats, note) values
  ('SW-002', 4, 2, 'JEUS Enterprise'),
  ('SW-008', 3, 1, 'WebtoB Enterprise'),
  ('SW-012', 2, 2, 'Oracle Database Processor'),
  ('SW-001', 10, 8, 'Red Hat Enterprise Linux Subscription');

-- ─── 9. notices (3건) ───────────────────────────────
insert into public.notices (category, title, author, status, content) values
  ('공지', 'DEMO 시연 환경 이용 안내', '정재율', '중요', '시연 중 변경된 데이터는 DEMO 데이터 설정에서 저장된 기준 상태로 복원할 수 있습니다.'),
  ('공지', 'SW 자산 등록 및 변경 요청 안내', '정재율', '일반', '신규 자산과 자산 정보 변경은 요청 메뉴를 통해 접수해 주세요.'),
  ('공지', '긴급 보안공지 조치 기준 안내', '오승인', '중요', 'Critical·High 보안공지는 영향 자산 확인 후 담당자에게 조치 업무로 전달합니다.');

-- ─── 10. patch_tasks (4건) ──────────────────────────
-- 상태 매핑: 진행중→조치예정, 진행중·기한초과→조치지연, 완료→조치완료
insert into public.patch_tasks (vulnerability_id, asset_id, owner, status, due_date, completed_at)
select v.id, a.asset_id, a.owner, a.status, a.due_date, a.completed_at
from (values
  ('DEMO-TOMCAT-9-001',   'SW-003', '이와스', '조치예정', (current_date + 7)::date, null::timestamptz),
  ('TMAX-72',             'SW-008', '최웹',   '조치지연', (current_date - 2)::date, null::timestamptz),
  ('DEMO-NGINX-001',      'SW-010', '최웹',   '조치완료', (current_date - 5)::date, now() - interval '5 days'),
  ('DEMO-ORACLE-CPU-001', 'SW-012', '김디비', '조치예정', (current_date + 5)::date, null::timestamptz)
) as a(cve, asset_id, owner, status, due_date, completed_at)
join public.vulnerabilities v on v.cve = a.cve;

-- ─── 11. notifications (7건) ────────────────────────
insert into public.notifications (category, title, description, asset, owner, status, urgent, read, link_view, link_label) values
  ('security', 'JEUS 긴급 보안공지 승인 대기',       'TMAX-71 (JEUS 7~9 원격 코드 실행 취약점) 공지가 승인 대기 중입니다.',      'JEUS 7.0 / 9.0',        '오승인', '승인대기', true,  false, 'vendor',      '제조사 공지에서 확인'),
  ('security', 'Oracle Critical Patch 조치 필요',    'SW-012 Oracle Database 19c 자산에 CPU 적용이 필요합니다.',                 'Oracle Database 19c',   '김디비', '확인필요', true,  false, 'patch-tasks', '내 조치 업무로 이동'),
  ('asset',    'JEUS 7 EOS 만료',                    'SW-002 JEUS 7.0 자산의 지원종료(EOS)가 도래했습니다.',                     'JEUS 7.0',              '이와스', '확인필요', true,  false, 'eos',          'EOS 로드맵에서 보기'),
  ('asset',    'PostgreSQL 17 신규 자산 요청 접수',  'REQ-2026-001 PostgreSQL 17.0 신규 자산 요청이 접수되었습니다.',            'PostgreSQL 17.0',       '오승인', '승인대기', false, false, 'approval',     '승인 관리로 이동'),
  ('security', 'WebtoB 패치 기한 초과',               'SW-008 WebtoB 자산 조치 업무 기한이 초과되었습니다.',                     'WebtoB 5.0 SP0 Fix4 B395','최웹', '확인필요', true,  false, 'patch-tasks', '내 조치 업무로 이동'),
  ('security', 'Nginx 보안패치 완료',                 'SW-010 Nginx 자산 보안 패치가 완료되었습니다.',                            'Nginx 1.24.0',          '최웹',   '완료',     false, true,  'patch',        '패치 현황에서 보기'),
  ('system',   '공식 Source 정기 수집 완료',          '공식 Source URL 7건에 대한 정기 수집이 완료되었습니다.',                    '전체',                  '정재율', '완료',     false, true,  'admin-collect','Source URL 관리로 이동');

-- ─── 12. 새 기준 스냅샷 저장 ─────────────────────────
select public.save_demo_snapshot();
