-- 라이브 DB의 assets_category_check 제약조건이 언젠가 'WAS'를 뺀 채로 바뀌어
-- 있었고(마이그레이션 파일·sw_masters·앱 코드는 전부 WAS를 유효 분류로 취급),
-- 그 결과 JEUS/Apache Tomcat 같은 WAS 자산이 'Middleware'로 잘못 재분류된 채
-- 남아 있었다. WAS를 다시 허용하고 기존 데이터를 원래 분류로 되돌린다.

alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets add constraint assets_category_check
  check (category in ('OS','WEB','WAS','DB','Middleware','Security'));

update public.assets
set category = 'WAS'
where name in ('JEUS', 'Apache Tomcat') and category = 'Middleware';
