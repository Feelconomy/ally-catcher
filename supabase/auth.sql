-- ══════════════════════════════════════════
-- 카카오 로그인(Supabase Auth) 연동용 마이그레이션
-- 기존 데이터 보존 — Supabase 대시보드 SQL Editor 에서 한 번 실행
-- ══════════════════════════════════════════

-- 플레이어 행을 인증 사용자(auth.users)와 연결하는 컬럼
alter table players add column if not exists auth_user_id uuid;

-- 인증 사용자당 플레이어 행은 하나 (익명 행은 auth_user_id가 null 이라 제약 대상 아님)
create unique index if not exists idx_players_auth
  on players(auth_user_id) where auth_user_id is not null;
