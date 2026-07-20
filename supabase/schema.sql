-- ══════════════════════════════════════════
-- 뽑아요! DB 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- ══════════════════════════════════════════

-- 플레이어 (닉네임 + PIN 로그인)
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  nickname text unique not null,
  pin text not null,
  tickets int not null default 5,
  total_pts int not null default 0,
  attempt_count int not null default 0,
  created_at timestamptz not null default now()
);

-- 뽑기 기록 (= 콜렉션)
create table if not exists pulls (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  doll_key text not null,
  name text not null,
  story text,
  rarity text not null,
  pts int not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pulls_player on pulls(player_id, created_at desc);

-- ⚠️ "보안 상관없이" 모드: anon 키로 모든 읽기/쓰기 허용
-- (RLS를 켜되 전체 허용 정책 — Supabase가 RLS 꺼진 테이블에 경고를 띄우므로)
alter table players enable row level security;
alter table pulls   enable row level security;

create policy "anyone can do anything (players)" on players
  for all using (true) with check (true);
create policy "anyone can do anything (pulls)" on pulls
  for all using (true) with check (true);
