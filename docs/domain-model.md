# Domain Model

## Scenario Context

시나리오 정의와 학습 목표를 관리한다.

- `ScenarioDefinition`: 시나리오 ID, 난이도, 증상, 힌트, 성공 조건, 초기 서버 상태
- `ScenarioSkill`: 학습할 운영 스킬과 대표 명령

## Simulation Context

가상 서버의 현재 상태를 표현한다.

- `SimulatedServerState`: 디스크, 로그 파일, 메모리, CPU, 프로세스, 서비스, DB, 배포, 설정, 알림, 로그
- `ServiceState`: 서비스 실행 상태와 포트/메시지
- `ProcessState`: PID, 사용자, CPU/RSS, 명령, 상태

## Observation Context

명령 실행 결과를 표현한다.

- `CommandResult`: stdout/stderr, exit code, 상태 변경 효과

## Remediation Context

사용자 조치와 위험도를 기록한다.

- `ActionRecord`: 명령, 결과, 효과, 위험도, 실행 시각
- 위험 명령은 시뮬레이터에서 차단한다.

## Evaluation Context

시도 결과를 평가한다.

- `Evaluation`: resolved, score, grade, summary, positives, improvements
- 점수는 해결 여부, 힌트 사용, 실패 명령, 위험 명령, 과도한 명령 수를 반영한다.
