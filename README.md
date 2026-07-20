# 뽑아요! AI 인형뽑기 🎪

모바일 웹 기반 인형뽑기 게임.

## 실행

빌드 없이 정적 파일만으로 동작합니다.

```bash
cd claw-machine
python3 -m http.server 8080
# 브라우저에서 http://localhost:8080 접속
```

모바일 테스트: 같은 와이파이에서 `http://<맥 IP>:8080` 접속.

## 구조

```
claw-machine/
├── index.html          # 마크업
├── style.css           # 스타일 (모바일 최적화)
├── game.js             # 게임 로직 전체
├── config.js           # Supabase URL/키 설정 (비어있으면 로컬 모드)
├── db.js               # Supabase REST 클라이언트 (SDK 없이 fetch)
├── supabase/
│   └── schema.sql      # DB 테이블 생성 SQL
└── assets/
    ├── wonhee.svg      # 인형: 졸업생 원희 (임시 이미지 — 원본 PNG로 교체 가능)
    └── ollie.svg       # 인형: 직장인 올리 (임시 이미지 — 원본 PNG로 교체 가능)
```

## 로그인 + 서버 저장 (Supabase)

기본은 **로컬 모드** (localStorage, 로그인 없음). Supabase를 연결하면
**닉네임+PIN 로그인** 화면이 뜨고 콜렉션/포인트/티켓이 서버에 저장돼서
어느 기기에서든 이어서 플레이할 수 있습니다.

연결 방법 (5분):

1. [supabase.com](https://supabase.com) 가입 → New Project 생성
2. 대시보드 → **SQL Editor** → `supabase/schema.sql` 내용 붙여넣고 Run
3. 대시보드 → **Settings → API** 에서 두 값 복사:
   - Project URL
   - anon public key
4. `config.js`에 붙여넣기:
   ```js
   window.CLAW_CONFIG = {
     SUPABASE_URL: 'https://xxxx.supabase.co',
     SUPABASE_ANON_KEY: 'eyJ...'
   };
   ```

로그인 방식: 닉네임 2~12자 + PIN 숫자 4자리.
처음 입력한 닉네임은 자동 가입, 이후엔 PIN이 맞아야 접속됩니다.

> ⚠️ 의도적으로 가벼운 로그인입니다. PIN은 평문 저장이고 anon 키로
> 모든 데이터 접근이 가능해요. 포인트에 실제 가치(제휴 등)가 붙는 시점엔
> 뽑기 판정과 포인트 적립을 서버(Edge Function)로 옮겨야 합니다.

## 인형 이미지 교체

원본 캐릭터 PNG가 있다면 `assets/`에 넣고 `index.html` 상단의
`img_wonhee` / `img_ollie` 태그의 `src`만 바꾸면 됩니다.

## AI 연동 (선택)

기본값은 **오프라인 모드** — 내장 문구 풀에서 인형 이름/스토리/응원 메시지를 뽑습니다.

Claude API로 실시간 생성하려면 API 키를 숨길 **프록시 서버**가 필요합니다
(브라우저에서 직접 호출하면 키가 노출됨). 프록시를 만든 뒤 `game.js` 상단의:

```js
var AI_PROXY_URL = '';   // 예: 'https://내서버/api/doll'
```

프록시가 받는 요청: `POST { type: 'doll-info'|'fail-msg', name, rarity, mood }`
프록시가 주는 응답: `{ name, story }` 또는 `{ message }`

## 게임 규칙

- 기본 성공률 40%, 실패할 때마다 +9% (최대 90%, 성공 시 리셋)
- 성공해도 올라오는 도중 20% 확률로 떨어뜨림
- 티켓/포인트/모음집은 localStorage에 자동 저장
