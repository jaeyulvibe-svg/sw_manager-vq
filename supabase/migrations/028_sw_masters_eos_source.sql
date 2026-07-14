-- =====================================================
--  SW 마스터 — endoflife.date 자동 EOS 수집을 위한 소스 매핑
--  화면에 표시된 제품명으로 매번 추측하지 않고, 이 필드를 기준으로
--  API 제품 코드를 결정한다. 지원 대상 5개 제품만 채우고,
--  JEUS/WebtoB/OpenSSL 등 나머지는 null로 남겨 자동수집 대상에서 제외한다.
-- =====================================================

alter table public.sw_masters
  add column if not exists eos_source text,
  add column if not exists eos_source_product_key text;

update public.sw_masters set eos_source = 'endoflife.date', eos_source_product_key = 'tomcat'
  where name = 'Apache Tomcat' and deleted_at is null;
update public.sw_masters set eos_source = 'endoflife.date', eos_source_product_key = 'nginx'
  where name = 'Nginx' and deleted_at is null;
update public.sw_masters set eos_source = 'endoflife.date', eos_source_product_key = 'postgresql'
  where name = 'PostgreSQL' and deleted_at is null;
update public.sw_masters set eos_source = 'endoflife.date', eos_source_product_key = 'oracle-database'
  where name = 'Oracle Database' and deleted_at is null;
update public.sw_masters set eos_source = 'endoflife.date', eos_source_product_key = 'rhel'
  where name = 'Red Hat Enterprise Linux' and deleted_at is null;

select public.save_demo_snapshot();
