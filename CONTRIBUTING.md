# 기여 가이드

칵테일바 신청곡 시스템을 개선해주셔서 감사합니다.

## 로컬 개발

```bash
npm install
npm start
```

브라우저에서 확인할 주소:

- 손님 신청 페이지: `http://localhost:3000/request`
- 직원 관리자 페이지: `http://localhost:3000/admin`
- 매장 디스플레이: `http://localhost:3000/display`

## 검증

PR을 열기 전에 아래 명령을 실행해주세요.

```bash
npm run check
npm audit
```

## PR 기준

- 빔프로젝터와 모바일 화면에서 모두 읽기 쉬운 UI를 유지합니다.
- `data/state.json`은 커밋하지 않습니다. 신청곡 기록, 사연, 참여자 이름이 들어갈 수 있습니다.
- 변경 범위는 작고 명확하게 유지합니다.
- 디스플레이 UI를 바꿨다면 `/display`와 `/request`를 함께 확인합니다.
- 매장 운영자가 바로 이해할 수 있는 한국어 문구를 우선 사용합니다.
# Contributing

Thanks for improving Cocktail Song Request.

## Local Development

```bash
npm install
npm start
```

Run checks before opening a pull request:

```bash
npm run check
npm audit
```

## Pull Request Guidelines

- Keep venue-facing UI readable on projector and mobile widths.
- Avoid committing `data/state.json`; it can contain request history and participant names.
- Prefer small, focused changes with a clear before/after description.
- When changing display UI, check `/display` and `/request` in a browser.
