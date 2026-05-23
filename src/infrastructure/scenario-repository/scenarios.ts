import type { ScenarioDefinition, ScenarioId, ScenarioListItem } from "@/domain/scenario/types";
import type { SimulatedServerState } from "@/domain/simulation/types";
import { cloneServerState } from "@/domain/simulation/types";

function baseState(overrides: Partial<SimulatedServerState>): SimulatedServerState {
  const state: SimulatedServerState = {
    hostname: "web-01",
    incidentResolved: false,
    disks: [
      { filesystem: "/dev/vda1", mount: "/", sizeGb: 80, usedGb: 41 },
      { filesystem: "/dev/vdb1", mount: "/var", sizeGb: 100, usedGb: 54 }
    ],
    logFiles: [
      { path: "/var/log/app.log", sizeMb: 640, owner: "app", rotated: true },
      { path: "/var/log/nginx/access.log", sizeMb: 220, owner: "www-data", rotated: true },
      { path: "/var/log/postgresql/postgresql.log", sizeMb: 180, owner: "postgres", rotated: true }
    ],
    memory: { totalMb: 8192, usedMb: 3600, swapUsedMb: 128, oomKills: 0 },
    cpu: { load1: 0.8, load5: 0.6, load15: 0.4, utilizationPercent: 23 },
    processes: [
      { pid: 1101, user: "root", command: "nginx: master process", cpuPercent: 0.2, memoryMb: 46, status: "running" },
      { pid: 1202, user: "app", command: "node server.js", cpuPercent: 8.4, memoryMb: 420, status: "running" },
      { pid: 1303, user: "postgres", command: "postgres", cpuPercent: 3.3, memoryMb: 512, status: "running" }
    ],
    services: [
      { name: "nginx", status: "running", port: 80, message: "active (running)" },
      { name: "app", status: "running", port: 3000, message: "active (running)" },
      { name: "postgresql", status: "running", port: 5432, message: "active (running)" },
      { name: "redis", status: "running", port: 6379, message: "active (running)" }
    ],
    database: { engine: "postgresql", maxConnections: 100, activeConnections: 24, waitingClients: 0, longTransactions: 0, slowQueries: 0 },
    deployment: { currentVersion: "2026.05.23.1", previousVersion: "2026.05.22.4", healthy: true, lastDeploySummary: "No recent deploy issues" },
    configFiles: [
      { path: "/etc/nginx/sites-enabled/app.conf", valid: true, summary: "proxy_pass http://127.0.0.1:3000" },
      { path: "/etc/logrotate.d/app", valid: true, summary: "daily rotate 7 compress" }
    ],
    alerts: [],
    logs: [],
    ...overrides
  };
  return state;
}

export const scenarios: ScenarioDefinition[] = [
  {
    id: "disk-full",
    title: "디스크 용량 부족",
    difficulty: "beginner",
    synopsis: "로그 폭증으로 /var 파티션이 가득 차 배포와 쓰기 작업이 실패한다.",
    initialAlert: "API 응답이 느려지고 배포가 'No space left on device'로 실패합니다.",
    learningGoals: ["디스크 사용률 확인", "큰 로그 파일 식별", "안전한 정리와 재발 방지 확인"],
    skills: [
      { label: "파일시스템 진단", commandExamples: ["df -h", "du -sh /var/log/*"] },
      { label: "로그 정리", commandExamples: ["truncate -s 0 /var/log/app.log", "logrotate -f /etc/logrotate.d/app"] }
    ],
    successCriteria: ["/var 사용률이 80% 미만", "app 서비스가 running", "health check 성공"],
    recommendedPath: ["df -h", "du -sh /var/log/*", "truncate -s 0 /var/log/app.log", "logrotate -f /etc/logrotate.d/app", "curl -f http://localhost/health"],
    dangerousActions: ["rm -rf /var/log", "mkfs", "reboot without diagnosis"],
    hints: ["먼저 어느 파티션이 찼는지 확인하세요.", "로그 디렉터리에서 비정상적으로 큰 파일을 찾으세요.", "무작정 삭제보다 truncate/logrotate가 안전합니다."],
    initialState: baseState({
      disks: [
        { filesystem: "/dev/vda1", mount: "/", sizeGb: 80, usedGb: 45 },
        { filesystem: "/dev/vdb1", mount: "/var", sizeGb: 100, usedGb: 98 }
      ],
      logFiles: [
        { path: "/var/log/app.log", sizeMb: 35840, owner: "app", rotated: false },
        { path: "/var/log/nginx/access.log", sizeMb: 1200, owner: "www-data", rotated: true },
        { path: "/var/log/postgresql/postgresql.log", sizeMb: 380, owner: "postgres", rotated: true }
      ],
      services: [
        { name: "nginx", status: "running", port: 80, message: "active (running)" },
        { name: "app", status: "degraded", port: 3000, message: "write errors: ENOSPC" },
        { name: "postgresql", status: "degraded", port: 5432, message: "could not extend file: No space left on device" },
        { name: "redis", status: "running", port: 6379, message: "active (running)" }
      ],
      alerts: [{ severity: "critical", message: "/var usage is 98%; deployments and writes are failing" }],
      logs: [
        { source: "app", level: "error", message: "ENOSPC: no space left on device, write '/var/log/app.log'" },
        { source: "postgresql", level: "error", message: "could not extend file: No space left on device" }
      ]
    })
  },
  {
    id: "memory-oom",
    title: "메모리 부족 / OOM Kill",
    difficulty: "intermediate",
    synopsis: "워커 메모리 누수로 커널 OOM killer가 앱 프로세스를 종료한다.",
    initialAlert: "앱이 몇 분마다 재시작되고 로그에 Out of memory가 보입니다.",
    learningGoals: ["메모리 압박 확인", "OOM 로그 확인", "문제 프로세스 격리"],
    skills: [
      { label: "메모리 진단", commandExamples: ["free -m", "top", "dmesg | tail"] },
      { label: "프로세스 조치", commandExamples: ["systemctl restart worker", "kill 2205"] }
    ],
    successCriteria: ["메모리 사용률 정상화", "OOM kill 증가 중단", "app/worker 정상"],
    recommendedPath: ["free -m", "top", "dmesg | tail", "systemctl restart worker", "curl -f http://localhost/health"],
    dangerousActions: ["kill -9 1", "swapoff -a", "reboot without diagnosis"],
    hints: ["커널 로그에서 OOM 흔적을 확인하세요.", "RSS가 비정상적으로 큰 프로세스를 찾으세요.", "임시 복구 후 메모리 제한/누수 조사를 기록하세요."],
    initialState: baseState({
      memory: { totalMb: 8192, usedMb: 7900, swapUsedMb: 1800, oomKills: 4 },
      processes: [
        { pid: 1202, user: "app", command: "node server.js", cpuPercent: 18.4, memoryMb: 1100, status: "running" },
        { pid: 2205, user: "app", command: "node worker.js --image-resizer", cpuPercent: 22.1, memoryMb: 5600, status: "running" },
        { pid: 1303, user: "postgres", command: "postgres", cpuPercent: 3.3, memoryMb: 512, status: "running" }
      ],
      services: [
        { name: "nginx", status: "running", port: 80, message: "active (running)" },
        { name: "app", status: "degraded", port: 3000, message: "recently restarted after OOM" },
        { name: "worker", status: "degraded", message: "memory usage growing" },
        { name: "postgresql", status: "running", port: 5432, message: "active (running)" },
        { name: "redis", status: "running", port: 6379, message: "active (running)" }
      ],
      alerts: [{ severity: "critical", message: "OOM kills detected on web-01" }],
      logs: [{ source: "kernel", level: "error", message: "Out of memory: Killed process 2198 (node) total-vm:6412MB" }]
    })
  },
  {
    id: "cpu-spike",
    title: "CPU 사용률 급증",
    difficulty: "beginner",
    synopsis: "배치 작업과 실시간 트래픽이 겹쳐 CPU가 포화되고 API 응답이 지연된다.",
    initialAlert: "p95 latency가 4초를 넘고 load average가 급증했습니다.",
    learningGoals: ["로드 애버리지 해석", "CPU 점유 프로세스 식별", "안전한 작업 중지"],
    skills: [
      { label: "CPU 진단", commandExamples: ["top", "ps aux --sort=-%cpu"] },
      { label: "작업 조치", commandExamples: ["kill 3307", "systemctl restart app"] }
    ],
    successCriteria: ["CPU 사용률 70% 미만", "앱 응답 정상", "원인 프로세스 기록"],
    recommendedPath: ["top", "ps aux --sort=-%cpu", "kill 3307", "curl -f http://localhost/health"],
    dangerousActions: ["kill database", "reboot without diagnosis"],
    hints: ["load average와 CPU 점유 프로세스를 함께 보세요.", "배치 프로세스인지 핵심 서비스인지 구분하세요.", "중지 후 health check로 효과를 확인하세요."],
    initialState: baseState({
      cpu: { load1: 7.8, load5: 6.2, load15: 3.4, utilizationPercent: 97 },
      processes: [
        { pid: 1202, user: "app", command: "node server.js", cpuPercent: 48.3, memoryMb: 510, status: "running" },
        { pid: 3307, user: "app", command: "node jobs/rebuild-search-index.js", cpuPercent: 164.2, memoryMb: 740, status: "running" },
        { pid: 1303, user: "postgres", command: "postgres", cpuPercent: 28.8, memoryMb: 620, status: "running" }
      ],
      services: [
        { name: "nginx", status: "running", port: 80, message: "active (running)" },
        { name: "app", status: "degraded", port: 3000, message: "high latency" },
        { name: "postgresql", status: "running", port: 5432, message: "active (running)" },
        { name: "redis", status: "running", port: 6379, message: "active (running)" }
      ],
      alerts: [{ severity: "critical", message: "CPU utilization is 97%; API latency elevated" }],
      logs: [{ source: "app", level: "warn", message: "request latency p95=4210ms" }]
    })
  },
  {
    id: "nginx-502",
    title: "Nginx 502 Bad Gateway",
    difficulty: "intermediate",
    synopsis: "Nginx upstream 포트가 앱 실제 포트와 달라 502가 발생한다.",
    initialAlert: "외부 사용자는 502를 보지만 앱 프로세스는 실행 중입니다.",
    learningGoals: ["프록시와 upstream 상태 구분", "Nginx 설정 검증", "reload/restart 차이 이해"],
    skills: [
      { label: "프록시 진단", commandExamples: ["systemctl status nginx", "nginx -t", "ss -ltnp"] },
      { label: "설정 반영", commandExamples: ["fix-nginx-upstream", "systemctl reload nginx"] }
    ],
    successCriteria: ["Nginx 설정 유효", "upstream 포트 일치", "health check 성공"],
    recommendedPath: ["systemctl status nginx", "nginx -t", "ss -ltnp", "fix-nginx-upstream", "systemctl reload nginx", "curl -f http://localhost/health"],
    dangerousActions: ["disable nginx", "delete site config"],
    hints: ["Nginx 자체가 죽었는지 upstream 문제인지 분리하세요.", "앱이 실제로 listen하는 포트를 확인하세요.", "설정 수정 후 reload로 반영하세요."],
    initialState: baseState({
      services: [
        { name: "nginx", status: "degraded", port: 80, message: "active but upstream returns connection refused" },
        { name: "app", status: "running", port: 3001, message: "active (running) on 127.0.0.1:3001" },
        { name: "postgresql", status: "running", port: 5432, message: "active (running)" },
        { name: "redis", status: "running", port: 6379, message: "active (running)" }
      ],
      configFiles: [
        { path: "/etc/nginx/sites-enabled/app.conf", valid: true, summary: "proxy_pass http://127.0.0.1:3000 but app listens on 3001" },
        { path: "/etc/logrotate.d/app", valid: true, summary: "daily rotate 7 compress" }
      ],
      alerts: [{ severity: "critical", message: "HTTP 502 rate is above threshold" }],
      logs: [{ source: "nginx", level: "error", message: "connect() failed (111: Connection refused) while connecting to upstream 127.0.0.1:3000" }]
    })
  },
  {
    id: "db-connection-exhaustion",
    title: "DB 커넥션 풀 고갈",
    difficulty: "advanced",
    synopsis: "장시간 열린 트랜잭션과 과도한 풀 크기로 PostgreSQL 커넥션이 고갈된다.",
    initialAlert: "API timeout과 'too many connections' 에러가 동시에 증가합니다.",
    learningGoals: ["DB 연결 수 확인", "긴 트랜잭션 식별", "풀 크기/앱 재시작 판단"],
    skills: [
      { label: "DB 진단", commandExamples: ["psql connections", "psql long-transactions"] },
      { label: "커넥션 완화", commandExamples: ["terminate-idle-transactions", "tune-db-pool", "systemctl restart app"] }
    ],
    successCriteria: ["active connections가 한계 이하", "waiting client 해소", "앱 정상"],
    recommendedPath: ["psql connections", "psql long-transactions", "terminate-idle-transactions", "tune-db-pool", "systemctl restart app", "curl -f http://localhost/health"],
    dangerousActions: ["restart postgresql first", "drop database connections blindly"],
    hints: ["서버 재시작 전에 현재 연결 상태를 확인하세요.", "idle in transaction이 많은지 보세요.", "풀 크기 조정과 앱 재시작을 함께 고려하세요."],
    initialState: baseState({
      database: { engine: "postgresql", maxConnections: 100, activeConnections: 99, waitingClients: 37, longTransactions: 18, slowQueries: 2 },
      services: [
        { name: "nginx", status: "running", port: 80, message: "active (running)" },
        { name: "app", status: "degraded", port: 3000, message: "database pool timeout" },
        { name: "postgresql", status: "degraded", port: 5432, message: "remaining connection slots are reserved" },
        { name: "redis", status: "running", port: 6379, message: "active (running)" }
      ],
      alerts: [{ severity: "critical", message: "PostgreSQL connections 99/100; waiting clients 37" }],
      logs: [
        { source: "app", level: "error", message: "remaining connection slots are reserved for non-replication superuser connections" },
        { source: "postgresql", level: "warn", message: "too many clients already" }
      ]
    })
  },
  {
    id: "bad-deployment-rollback",
    title: "배포 후 장애 / 롤백",
    difficulty: "intermediate",
    synopsis: "새 버전에 필수 환경변수가 빠져 health check가 실패한다.",
    initialAlert: "방금 배포한 버전 이후 500 에러율이 급증했습니다.",
    learningGoals: ["배포 전후 상태 비교", "로그에서 환경변수 누락 확인", "안전한 롤백"],
    skills: [
      { label: "배포 진단", commandExamples: ["deploy status", "journalctl -u app"] },
      { label: "롤백", commandExamples: ["deploy rollback", "systemctl restart app"] }
    ],
    successCriteria: ["이전 정상 버전 복구", "health check 성공", "원인 기록"],
    recommendedPath: ["deploy status", "journalctl -u app", "deploy rollback", "curl -f http://localhost/health"],
    dangerousActions: ["rollback database blindly", "keep retrying same deploy"],
    hints: ["장애가 배포 직후 시작됐는지 확인하세요.", "앱 로그의 missing env 메시지를 찾으세요.", "사용자 영향이 크면 먼저 롤백 후 원인 분석하세요."],
    initialState: baseState({
      services: [
        { name: "nginx", status: "running", port: 80, message: "active (running)" },
        { name: "app", status: "failed", port: 3000, message: "crashloop: missing STRIPE_SECRET_KEY" },
        { name: "postgresql", status: "running", port: 5432, message: "active (running)" },
        { name: "redis", status: "running", port: 6379, message: "active (running)" }
      ],
      deployment: { currentVersion: "2026.05.23.2", previousVersion: "2026.05.22.4", healthy: false, lastDeploySummary: "Deployed checkout refactor 8 minutes ago", envMissing: "STRIPE_SECRET_KEY" },
      alerts: [{ severity: "critical", message: "HTTP 500 rate 42% after deployment 2026.05.23.2" }],
      logs: [{ source: "app", level: "error", message: "ConfigurationError: missing required env STRIPE_SECRET_KEY" }]
    })
  }
];

export function listScenarios(): ScenarioListItem[] {
  return scenarios.map(({ id, title, difficulty, synopsis, initialAlert, learningGoals }) => ({
    id,
    title,
    difficulty,
    synopsis,
    initialAlert,
    learningGoals
  }));
}

export function getScenario(id: ScenarioId | string): ScenarioDefinition | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}

export function createInitialState(id: ScenarioId | string): SimulatedServerState | undefined {
  const scenario = getScenario(id);
  return scenario ? cloneServerState(scenario.initialState) : undefined;
}
