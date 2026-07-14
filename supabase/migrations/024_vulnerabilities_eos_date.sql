-- =====================================================
--  EOS 유형 공지의 지원종료 일자를 명시적으로 저장.
--  지금까지는 PostgreSQL 수집기만 collected_at을 EOS 날짜로
--  억지로 재활용했고(화면엔 "수집 일시"로만 표시돼 오해 유발),
--  JEUS/WebtoB EOS 공지는 날짜를 아예 저장하지 않았다.
--  eos_date를 별도 컬럼으로 두고, 파싱 가능한 곳만 채운다
--  (제조사가 제목에 종료일을 안 적어주면 null로 남아 "정보 없음"으로 표시됨).
-- =====================================================

alter table public.vulnerabilities
  add column if not exists eos_date date;

-- 기존 PostgreSQL EOS 공지는 collected_at에 저장돼 있던 실제 EOS 날짜를 옮긴다.
update public.vulnerabilities
set eos_date = collected_at::date
where notice_type = 'EOS' and cve = 'PG-EOS-16';
