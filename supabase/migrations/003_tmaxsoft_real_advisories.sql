-- =====================================================
--  실제 공식 출처 기반 EOS/Patch/CVE 실사 반영
--  실사 확인일: 2026-07-08 ~ 2026-07-09
--
--  주의: 최초 작성 시 Apache Tomcat을 저장소의 002_seed_data.sql(9.0.89 기준)
--  스펙으로 조사했으나, 실제 라이브 DB의 설치 버전은 10.1.20이었다.
--  이 파일은 라이브 DB에 실제 적용된 최종 값(10.1.x 브랜치)으로 맞춰 기록한다.
--  JEUS도 라이브 자산은 8.0.3이며, TmaxSoft 공식 EOL/EOS Calendar에는 7.x까지만
--  등재되어 있어 8.x의 EOS 확정일이 없으므로 assets.eos는 갱신하지 않았다.
--
--  출처:
--    - Apache Tomcat: tomcat.apache.org/security-10.html (10.1.x 브랜치, 자산 설치버전 10.1.20 기준)
--    - JEUS/WebtoB:   www.tmaxsoft.com/kr/developer/notice/list (공식 기술공지)
--                     TmaxSoft EOL/EOS Calendar (공지 seq=69, JEUS 7.x까지만 등재)
--    - JEUS 최신버전:  docs.tmaxsoft.com/ko/jeus/21_fix1 (실존 확인)
--
--  TmaxSoft는 CVE 번호를 부여하지 않으므로, 자체 공지 게시글 번호(seq)를
--  "TMAX-{seq}" 형태로 cve 컬럼에 사용해 중복 수집을 방지한다.
--  latest_version 등 버전 확인성 항목은 "TMAX-VER-{product}" 형태의 고유키를 사용한다.
-- =====================================================

-- ─── notice_type 컬럼 추가: CVE / Patch / EOS 통합 관리 ───
alter table public.vulnerabilities
  add column if not exists notice_type text not null default 'CVE'
  check (notice_type in ('CVE', 'Patch', 'EOS'));

-- cve를 자동수집 idempotency key로 사용하기 위한 유니크 제약 (최초 실행 시 1회 추가)
alter table public.vulnerabilities add constraint vulnerabilities_cve_key unique (cve);

-- ─── CVE: Apache Tomcat 10.1.x (설치버전 10.1.20 기준, 10.1.56에서 수정) ───
insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('CVE-2026-55956', 'Security constraints for default servlet ignored method', 'Medium', 'Apache Tomcat 10.1.0-M1 to 10.1.55', 'Apache Tomcat 공식 보안 공지', 'https://tomcat.apache.org/security-10.html', 0, '승인대기', 'CVE', '2026-06-29 00:00:00+09')
on conflict (cve) do nothing;

insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('CVE-2026-55955', 'EncryptInterceptor not protected against replay attacks', 'Low', 'Apache Tomcat 10.1.0-M1 to 10.1.55', 'Apache Tomcat 공식 보안 공지', 'https://tomcat.apache.org/security-10.html', 0, '승인대기', 'CVE', '2026-06-29 00:00:00+09')
on conflict (cve) do nothing;

insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('CVE-2026-55276', 'Logged effective web.xml is incomplete', 'Low', 'Apache Tomcat 10.1.0-M1 to 10.1.55', 'Apache Tomcat 공식 보안 공지', 'https://tomcat.apache.org/security-10.html', 0, '승인대기', 'CVE', '2026-06-29 00:00:00+09')
on conflict (cve) do nothing;

insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('CVE-2026-53434', 'Invalid CRL configuration doesnt trigger failure for FFM Connector', 'Low', 'Apache Tomcat 10.1.0-M7 to 10.1.55', 'Apache Tomcat 공식 보안 공지', 'https://tomcat.apache.org/security-10.html', 0, '승인대기', 'CVE', '2026-06-29 00:00:00+09')
on conflict (cve) do nothing;

insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('CVE-2026-53404', 'Bad ornext processing in RewriteValve', 'Low', 'Apache Tomcat 10.1.0-M1 to 10.1.55', 'Apache Tomcat 공식 보안 공지', 'https://tomcat.apache.org/security-10.html', 0, '승인대기', 'CVE', '2026-06-29 00:00:00+09')
on conflict (cve) do nothing;

insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('CVE-2026-50229', 'XSS in number guess example', 'Low', 'Apache Tomcat 10.1.0-M1 to 10.1.55', 'Apache Tomcat 공식 보안 공지', 'https://tomcat.apache.org/security-10.html', 0, '승인대기', 'CVE', '2026-06-29 00:00:00+09')
on conflict (cve) do nothing;

-- ─── CVE: JEUS / WebtoB (TmaxSoft 공식 기술공지, JEUS 6~9 범위 - 설치버전 8.0.3 포함) ───
insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('TMAX-73', 'JEUS 역직렬화 취약점 대응 패치 및 JDK 업데이트 권고 가이드', 'High', 'JEUS 6~9', 'TmaxSoft 공식 기술공지', 'https://www.tmaxsoft.com/kr/developer/notice/view?seq=73&boardCd=notice', 0, '승인대기', 'CVE', '2026-07-07 00:00:00+09')
on conflict (cve) do nothing;

insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('TMAX-71', 'JEUS 원격 코드 실행 보안 취약점 가이드', 'Critical', 'JEUS 6~9 (JEUS 엔진 사용 전 제품군)', 'TmaxSoft 공식 기술공지', 'https://www.tmaxsoft.com/kr/developer/notice/view?seq=71&boardCd=notice', 0, '승인대기', 'CVE', '2026-04-07 00:00:00+09')
on conflict (cve) do nothing;

insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('TMAX-72', 'WebtoB 5 버전 버퍼 오버플로우 취약점 가이드', 'High', 'WebtoB 5.0 SP0 Fix2~Fix4 B395', 'TmaxSoft 공식 기술공지', 'https://www.tmaxsoft.com/kr/developer/notice/view?seq=72&boardCd=notice', 0, '승인대기', 'CVE', '2026-05-04 00:00:00+09')
on conflict (cve) do nothing;

-- ─── EOS: JEUS 7.x (판매종료 2022-06-30, 연장지원 종료 2025-06-30 - 이미 만료) ───
-- 설치 자산은 8.0.3이라 assets.eos는 이 값으로 갱신하지 않았음 (아래 UPDATE 참고)
insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('TMAX-EOS-JEUS7', 'JEUS 7.x 서비스 종료(EOS) 및 연장지원(ES) 만료 안내 - 2025-06-30 만료', 'High', 'JEUS 7.x', 'TmaxSoft 공식 EOL/EOS Calendar', 'https://www.tmaxsoft.com/kr/developer/notice/view?seq=69&boardCd=notice', 0, '승인대기', 'EOS', '2024-07-01 00:00:00+09')
on conflict (cve) do nothing;

-- ─── Patch: 최신 버전 확인 (JEUS 21 Fix1 / WebtoB 5.0 SP0 Fix4 B396) ───
insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('TMAX-VER-JEUS', 'JEUS 최신 버전 확인 - JEUS 21 Fix1 (설치 자산 JEUS 8.0.3)', 'High', 'JEUS 21 Fix1', 'TmaxSoft 공식 문서 docs.tmaxsoft.com', 'https://docs.tmaxsoft.com/ko/jeus/21_fix1/release-note/chapter-21-fix1.html', 0, '승인대기', 'Patch', now())
on conflict (cve) do nothing;

insert into public.vulnerabilities (cve, title, severity, product, source, source_url, mapped_assets, approval, notice_type, collected_at) values
  ('TMAX-VER-WEBTOB', 'WebtoB 5.0 최신 패치 확인 - SP0 Fix4 B396', 'Medium', 'WebtoB 5.0 SP0', 'TmaxSoft 공식 기술공지', 'https://www.tmaxsoft.com/kr/developer/notice/view?seq=72&boardCd=notice', 0, '승인대기', 'Patch', '2026-05-04 00:00:00+09')
on conflict (cve) do nothing;

-- ─── assets 테이블 실데이터 반영 (name 기준 - 서버 인스턴스별 여러 행에 동일 적용) ───
update public.assets set latest_version = '10.1.57', vuln = 'Medium', patch = 'Patch Required' where name = 'Apache Tomcat';
update public.assets set latest_version = 'JEUS 21 Fix1', vuln = 'Critical', patch = 'Patch Required' where name = 'JEUS';
update public.assets set latest_version = '5.0 SP0 Fix4 B396', vuln = 'High', patch = 'Patch Available' where name = 'WebtoB';
