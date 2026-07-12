-- assets 테이블도 request_seq(004_fix_request_seq.sql)와 같은 문제를 겪고 있었다:
-- 002_seed_data.sql 및 이후 재시딩이 id를 'SW-001'처럼 하드코딩으로 직접 넣어
-- assets_seq를 한 번도 통하지 않았고, 그 결과 신규 자산 요청을 승인할 때
-- (approval-view.tsx가 assets에 insert) nextval('assets_seq')가 이미 사용 중인
-- id와 충돌해 insert가 실패했다. 시퀀스를 현재 존재하는 최대 번호 이후로 맞춘다.
select setval(
  'assets_seq',
  greatest(
    1,
    coalesce(
      (select max(substring(id from '(\d+)$')::int) from public.assets),
      0
    )
  ),
  true
);
