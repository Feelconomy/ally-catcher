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
├── index.html      # 마크업
├── style.css       # 스타일 (모바일 최적화)
├── game.js         # 게임 로직 전체
└── assets/
    ├── wonhee.svg  # 인형: 졸업생 원희 (임시 이미지 — 원본 PNG로 교체 가능)
    └── ollie.svg   # 인형: 직장인 올리 (임시 이미지 — 원본 PNG로 교체 가능)
```

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
