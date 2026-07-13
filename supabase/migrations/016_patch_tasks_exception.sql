-- 담당자 조치 현황 — 예외요청/승인 (2차 스코프)
-- 조치가 불필요/보류로 판단되는 건을 담당자가 예외요청(사유 필수)하고,
-- 관리자가 승인(종결)하거나 반려(조치예정으로 복귀)할 수 있도록
-- status check 제약에 두 값을 추가한다.

alter table public.patch_tasks drop constraint if exists patch_tasks_status_check;
alter table public.patch_tasks add constraint patch_tasks_status_check
  check (status in ('배정됨','조치예정','조치지연','조치완료','예외요청','예외승인'));
