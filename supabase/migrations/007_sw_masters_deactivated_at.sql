-- =====================================================
--  SW 마스터 — 사용 여부가 '미사용'으로 바뀐 시점 기록
-- =====================================================

alter table public.sw_masters
  add column if not exists deactivated_at timestamptz;
