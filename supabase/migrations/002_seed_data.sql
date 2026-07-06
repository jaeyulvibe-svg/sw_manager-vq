-- =====================================================
--  Seed Data — 초기 목업 데이터
--  001_initial_schema.sql 실행 후 적용하세요
-- =====================================================

-- ─── 자산 목록 ─────────────────────────────────────
insert into public.assets (id, name, vendor, category, version, latest_version, server, owner, vuln, patch, eos, approval, checked_at) values
  ('SW-001', 'Apache Tomcat',          'Apache',            'WAS',      '9.0.89',  '10.1.24', 'WAS-PRD-01',  '홍길동',   'High',     'Patch Required',  '2027-03-31', '승인대기', now()),
  ('SW-002', 'JEUS',                   'TmaxSoft',          'WAS',      '7.0',     '8.5',     'WAS-PRD-02',  '김철수',   'Medium',   'Up to Date',      '2026-12-31', '확인필요', now()),
  ('SW-003', 'WebtoB',                 'TmaxSoft',          'WEB',      '5.0',     '6.0',     'WEB-PRD-01',  '이영희',   'Low',      'Patch Available', '2028-06-30', '승인완료', now() - interval '1 day'),
  ('SW-004', 'Oracle Database',        'Oracle',            'DB',       '19c',     '23c',     'DB-PRD-01',   '박민수',   'Critical', 'Patch Required',  '2029-04-30', '승인대기', now()),
  ('SW-005', 'OpenSSL',                'OpenSSL Project',   'Security', '3.0.x',   '3.3.1',   'SEC-PRD-01',  '정재율',   'Critical', 'Patch Required',  '2026-10-31', '긴급',     now()),
  ('SW-006', 'Nginx',                  'F5',                'WEB',      '1.24',    '1.27',    'WEB-PRD-02',  '이영희',   'Medium',   'Up to Date',      '2027-05-31', '승인완료', now() - interval '1 day'),
  ('SW-007', 'Red Hat Enterprise Linux','Red Hat',          'OS',       '8.x',     '9.4',     'OS-PRD-04',   '인프라팀', 'Low',      'Up to Date',      '2029-05-31', '승인완료', now()),
  ('SW-008', 'PostgreSQL',             'PostgreSQL GDG',    'DB',       '16.2',    '16.3',    'DB-PRD-03',   '김철수',   'High',     'Patch Available', '2028-11-09', '확인필요', now());

-- ─── 취약점 공지 ─────────────────────────────────────
insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, collected_at) values
  ('CVE-2026-0001', 'OpenSSL 원격 코드 실행 취약점 보안공지',         'Critical', 'OpenSSL 3.0.x',       'KNVD',            'knvd.krcert.or.kr', 4, '승인대기', now() - interval '30 minutes'),
  ('CVE-2026-0002', 'Apache Tomcat 취약점 보안 업데이트 권고',        'High',     'Apache Tomcat 9.0.x', 'KrCERT',          'krcert.or.kr',      8, '검토중',   now() - interval '1 hour 15 minutes'),
  ('Multiple CVEs', 'Oracle Database Critical Patch Update',          'Critical', 'Oracle Database 19c', 'Vendor Advisory', null,                2, '승인완료', now() - interval '1 day 6 hours'),
  ('CVE-2026-0003', 'Nginx 보안 패치 권고',                           'High',     'Nginx 1.x',           'KNVD',            'knvd.krcert.or.kr', 5, '승인대기', now() - interval '1 day 8 hours');

-- ─── 신규 자산 요청 ─────────────────────────────────
insert into public.asset_requests (no, name, vendor, version, category, server, owner, reason, requester, requester_dept, approval, urgency) values
  ('REQ-2026-001', 'PostgreSQL',  'PostgreSQL GDG', '16.3', 'DB',  'DB-DEV-02',  '김철수', 'ERP 시스템 개발용 DB 서버 도입 필요',              '김철수', '개발팀', '승인대기', '일반'),
  ('REQ-2026-002', 'Redis',       'Redis Ltd.',      '7.2',  'DB',  'CACHE-PRD-01', '이영희', '세션 캐시 서버 성능 개선을 위한 Redis 도입',   '이영희', '인프라팀', '검토중', '일반'),
  ('REQ-2026-003', 'Apache Kafka','Apache',          '3.7',  'Middleware', 'MQ-PRD-01', '박민수', '실시간 이벤트 스트리밍 파이프라인 구축',   '박민수', '아키텍처팀', '승인완료', '일반'),
  ('REQ-2026-004', 'Elasticsearch','Elastic',        '8.14', 'Middleware', 'SEARCH-PRD-01', '홍길동', '로그 분석 및 전문 검색 시스템 구축',  '홍길동', '운영팀', '승인대기', '긴급');

-- ─── 알림 ─────────────────────────────────────────────
insert into public.notifications (category, title, description, asset, owner, status, urgent, read, link_view, link_label, created_at) values
  ('security', 'OpenSSL 패치 공지 승인 대기',      'OpenSSL 3.0.x 관련 신규 패치 공지가 수집되었습니다.',         'OpenSSL 3.0.x',           '정재율', '승인대기', true,  false, 'approval', '승인 관리로 이동',      now() - interval '5 minutes'),
  ('asset',    'JEUS 7 EOS 임박',                  'JEUS 7 자산의 EOS 일정이 6개월 이내로 접근했습니다.',          'JEUS 7',                  '김철수', '확인필요', true,  false, 'eos',      'EOS 관리로 이동',       now() - interval '20 minutes'),
  ('asset',    '신규 SW 자산 등록 요청',            'Apache Tomcat 자산 등록 요청이 접수되었습니다.',               'Apache Tomcat',           '홍길동', '승인대기', false, false, 'approval', '신규 자산 요청으로 이동', now() - interval '35 minutes'),
  ('security', 'KNVD 긴급 보안공지 수집',           'Apache Tomcat 관련 High 등급 취약점 공지가 수집되었습니다.',   'Apache Tomcat 9.0.x',     '홍길동', '검토중',   true,  false, 'kisa',     '보안공지 관리로 이동',   now() - interval '1 hour'),
  ('security', 'Oracle DB 패치 확인 필요',          'Oracle Database 19c 관련 Critical Patch Update가 수집되었습니다.', 'Oracle Database 19c', '박민수', '확인필요', false, false, 'owner',    '패치 관리로 이동',      now() - interval '2 hours'),
  ('asset',    'SW 자산 담당자 변경',               'Nginx 1.24.x 자산의 담당자가 이수민으로 변경되었습니다.',      'Nginx 1.24.x',            '이수민', '완료',     false, false, 'assets',   '자산 상세로 이동',      now() - interval '3 hours'),
  ('system',   '자동수집 스케줄러 정상 완료',        '공식 Source URL 86개에 대한 정기 수집이 완료되었습니다.',      '전체',                    '관리자', '완료',     false, false, 'admin',    '수집 로그 보기',        now() - interval '45 minutes'),
  ('system',   '자동수집 실패 알림',               'Red Hat Source URL 수집이 3회 연속 실패했습니다. 점검이 필요합니다.', 'Red Hat Enterprise Linux', '관리자', '긴급', true, true, 'admin', '수집 로그 보기',        now() - interval '7 hours');

-- ─── 공지사항 ─────────────────────────────────────────
insert into public.notices (category, title, author, status, views) values
  ('시스템', 'AI SW Asset Master 정기 점검 안내',         '관리자',     '중요', 128),
  ('운영',   '신규 SW 자산 등록 기준 안내',                '관리자',     '일반', 94),
  ('승인',   '패치 승인 프로세스 변경 안내',               '승인관리자', '중요', 76),
  ('보고서', '6월 SW 자산·보안 월간 보고서 생성 안내',     '관리자',     '일반', 63);
