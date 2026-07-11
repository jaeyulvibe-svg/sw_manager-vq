-- =====================================================
--  SW 라이선스 관리 — 자산 1건당 라이선스 1건(보유 수량 vs 사용량)
-- =====================================================

create table if not exists public.licenses (
  id          uuid primary key default gen_random_uuid(),
  asset_id    text not null unique references public.assets(id) on delete cascade,
  total_seats int not null check (total_seats >= 0),
  used_seats  int not null default 0 check (used_seats >= 0),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger licenses_updated_at
  before update on public.licenses
  for each row execute function public.set_updated_at();

alter table public.licenses enable row level security;

-- 임시 정책: anon 키로 읽기/쓰기 허용 (운영 전 인증 연동 후 축소 필요)
create policy "allow_all_licenses" on public.licenses for all using (true) with check (true);
