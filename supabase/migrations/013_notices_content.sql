-- =====================================================
--  공지사항 게시판 — 상세보기용 본문(content) 컬럼 추가
-- =====================================================

alter table public.notices
  add column if not exists content text not null default '';
