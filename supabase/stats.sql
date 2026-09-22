-- ══════════════════════════════════════════
-- 누적 플레이 통계 (마이페이지 '총 플레이' · '성공')
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- 그동안 플레이·성공 수는 브라우저에만 남아서, 기기를 바꾸거나 다시 로그인하면
-- 0부터 다시 셌다. 티켓·포인트처럼 플레이어 행에 함께 저장한다.
-- 기존 행은 0 으로 시작하고, 앱이 처음 동기화할 때 그 기기의 기록을 올린다.
-- ══════════════════════════════════════════

alter table players add column if not exists plays int not null default 0;
alter table players add column if not exists wins  int not null default 0;
