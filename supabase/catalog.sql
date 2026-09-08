-- ══════════════════════════════════════════
-- 관리자 카탈로그 (인형 · 인형뽑기 기계)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- 관리자 페이지에서 고친 값을 모든 기기가 함께 보도록 서버에 둔다.
-- 한 줄(id='admin')에 통째로 넣는다 — 편집이 드물고, 부분 병합보다
-- 통짜 저장이 훨씬 단순하다. 대신 마지막에 저장한 쪽이 이긴다.
-- ══════════════════════════════════════════

create table if not exists catalog (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- players/prizes 와 같은 "보안 상관없이" 모드: anon 키로 읽기/쓰기 허용
alter table catalog enable row level security;
drop policy if exists c_all on catalog;
create policy c_all on catalog for all using (true) with check (true);
