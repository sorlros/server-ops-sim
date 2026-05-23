# ServerOps Simulator

웹 터미널에서 서버 장애를 진단하고 해결하는 운영 학습 시뮬레이터입니다.

## MVP

- Next.js + TypeScript
- DDD/TDD 구조
- 실제 서버 조작 없는 상태머신 기반 시뮬레이션
- MVP 시나리오 6개
  - 디스크 용량 부족
  - 메모리 부족 / OOM Kill
  - CPU 사용률 급증
  - Nginx 502 Bad Gateway
  - DB 커넥션 풀 고갈
  - 배포 후 장애 / 롤백

## Scenario Seeds

MVP 시나리오 정의는 `src/infrastructure/scenario-repository/seeds/scenarios.seed.json`에서 관리합니다. 코드 변경 없이 시나리오 문구, 초기 상태, 힌트, 추천 해결 경로를 검토하기 쉽도록 seed를 JSON으로 분리했습니다.

## Scripts

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

## 주요 명령 예시

시나리오 시작 후 웹 터미널에서 다음 명령을 입력합니다.

```bash
help
df -h
du -sh /var/log/*
free -m
top
ps aux --sort=-%cpu
systemctl status nginx
journalctl -u app
curl -f http://localhost/health
```
