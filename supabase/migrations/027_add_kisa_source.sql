-- =====================================================
--  공식 Source URL 관리에 KISA(KNVD) 행 추가
--  기존에는 KISA가 COLLECT_PRODUCTS에는 있었지만 sources 테이블에
--  행이 없어 "공식 Source URL 관리" 표에 노출되지 않았고,
--  따라서 KISA만 개별 수집하는 버튼도 뜰 자리가 없었다.
-- =====================================================

insert into public.sources (id, name, type, url, cycle, status)
values ('S-008', 'KISA', 'KISA 보안공지(KNVD)', 'https://knvd.krcert.or.kr/rss/security/notice', '일 1회', '정상')
on conflict (id) do nothing;

-- 이 마이그레이션 적용 시점의 데이터를 새 DEMO 기준 스냅샷으로 저장 —
-- 이후 "DEMO 데이터 설정" 화면의 "초기화"를 눌러도 KISA 행이 유지된다.
select public.save_demo_snapshot();
