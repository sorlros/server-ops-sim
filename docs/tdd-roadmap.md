# TDD Roadmap

## 1. Domain Unit Tests

- 시나리오 초기 상태가 장애 조건을 반영하는지 검증한다.
- 관측 명령이 상태를 변경하지 않는지 검증한다.
- 조치 명령이 올바른 상태 전이를 만드는지 검증한다.
- 위험 명령이 차단되는지 검증한다.
- 평가 점수가 힌트/실패/위험 조치를 반영하는지 검증한다.

## 2. Application Use Case Tests

- `startScenario`: 시나리오별 attempt 생성
- `executeCommand`: 명령 실행, history 누적, evaluation 갱신
- `useHint`: 힌트 제공과 감점 반영

## 3. Integration Tests

- API 라우트로 시작 → 명령 실행 → 상태 조회 → 평가 흐름을 검증한다.

## 4. E2E Tests

- 웹 UI에서 Disk Full 시나리오를 시작하고 `df -h` → `du` → `truncate` → `curl` 순서로 해결한다.
