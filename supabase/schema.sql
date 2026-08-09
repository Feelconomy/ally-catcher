-- ══════════════════════════════════════════
-- 올리캐쳐 DB 스키마 (익명 기기 ID 기반 저장)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- ⚠️ 아래 DROP은 이전 버전(원희/올리)의 players/pulls 테이블과
--    '몽화당' 데이터를 모두 삭제합니다. (요청대로 정리)
-- ══════════════════════════════════════════

drop table if exists pulls;
drop table if exists prizes;
drop table if exists players cascade;

-- 플레이어 (지금은 익명 기기 ID로 식별. 로그인은 나중에 nickname으로 연결)
create table players (
  id         uuid primary key default gen_random_uuid(),
  device_id  text unique not null,   -- 브라우저별 익명 ID (localStorage)
  nickname   text,                   -- 로그인 붙이면 채워짐 (지금은 null 가능)
  tickets    int  not null default 0,
  points     int  not null default 0,
  created_at timestamptz not null default now()
);

-- 뽑은 인형 (= 보관함). doll_id 예: 'bear', 'rabbit'
create table prizes (
  id        bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  doll_id   text not null,
  won_at    timestamptz not null default now()
);
create index idx_prizes_player on prizes(player_id, won_at desc);

-- "보안 상관없이" 모드: anon 키로 전체 읽기/쓰기 허용
alter table players enable row level security;
alter table prizes  enable row level security;
create policy p_all on players for all using (true) with check (true);
create policy z_all on prizes  for all using (true) with check (true);
