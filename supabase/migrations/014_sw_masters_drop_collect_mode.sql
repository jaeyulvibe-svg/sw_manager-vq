-- =====================================================
--  SW 마스터 관리 — collect_mode 컬럼 제거
--  (AUTO/SEMI_AUTO/MANUAL 구분이 실제 수집 로직에 아무 영향도 주지 않는
--   표시용 라벨에 불과해 혼란만 줘서 컬럼 자체를 없앤다)
-- =====================================================

alter table public.sw_masters
  drop column if exists collect_mode;
