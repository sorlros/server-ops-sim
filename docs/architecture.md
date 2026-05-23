# Architecture

## 기술 스택

- Next.js App Router
- TypeScript strict mode
- Vitest
- CSS Modules 없이 전역 CSS로 MVP UI 구성

## 계층 구조

```text
src/app              Next.js pages and route handlers
src/components       client UI
src/domain           pure domain types and evaluation logic
src/application      use cases
src/infrastructure   scenario seed, state machine, in-memory store
tests                domain/application tests
```

## 의존성 방향

- UI/API → application → domain/infrastructure
- domain은 Next.js, React, 저장소 구현에 의존하지 않는다.
- 상태머신은 infrastructure에 두고, 순수 입력/출력 형태로 테스트한다.

## 저장 전략

MVP는 `globalThis` 기반 인메모리 attempt store를 사용한다. 이후 사용자 계정/진도 저장이 필요하면 DB repository로 교체한다.

## 확장 지점

- 시나리오 seed 추가
- 명령어 핸들러 추가
- AI 기반 힌트/포스트모템 피드백
- Docker 기반 실습 시나리오
