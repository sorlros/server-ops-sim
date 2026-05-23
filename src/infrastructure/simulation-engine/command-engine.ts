import type { ScenarioDefinition } from "@/domain/scenario/types";
import type { CommandResult } from "@/domain/observation/types";
import type { RemediationRisk } from "@/domain/remediation/types";
import type { DiskVolume, LogEntry, LogFileState, ProcessState, ServiceName, SimulatedServerState } from "@/domain/simulation/types";
import { cloneServerState } from "@/domain/simulation/types";

export interface SimulatedCommandExecution {
  state: SimulatedServerState;
  result: CommandResult;
  risk: RemediationRisk;
}

export function executeSimulatedCommand(
  scenario: ScenarioDefinition,
  currentState: SimulatedServerState,
  rawCommand: string
): SimulatedCommandExecution {
  const command = normalize(rawCommand);
  const state = cloneServerState(currentState);
  const effects: string[] = [];
  let exitCode = 0;
  let stdout = "";
  let stderr = "";
  let risk: RemediationRisk = "safe";

  if (!command) {
    return result(state, rawCommand, 1, "", "명령어를 입력하세요.", [], "safe");
  }

  if (isDangerous(command)) {
    risk = "dangerous";
    exitCode = 2;
    stderr = "시뮬레이터가 위험한 운영 명령을 차단했습니다. 원인 확인과 백업/승인 없이 파괴적 조치를 수행하지 마세요.";
    effects.push("위험 명령 차단");
    return result(state, command, exitCode, stdout, stderr, effects, risk);
  }

  switch (true) {
    case command === "help":
      stdout = helpText(scenario);
      break;
    case command === "df -h":
      stdout = formatDf(state.disks);
      break;
    case command === "du -sh /var/log/*":
      stdout = formatDu(state.logFiles);
      break;
    case command === "free -m":
      stdout = formatFree(state);
      break;
    case command === "top":
      stdout = formatTop(state);
      break;
    case command === "ps aux --sort=-%cpu":
    case command === "ps aux --sort=-%mem":
      stdout = formatPs(state.processes, command.includes("%mem") ? "memory" : "cpu");
      break;
    case command === "dmesg | tail":
    case command === "dmesg":
      stdout = formatLogs(state.logs.filter((log) => log.source === "kernel"));
      break;
    case command.startsWith("systemctl status "):
      stdout = formatServiceStatus(state, command.replace("systemctl status ", "") as ServiceName);
      if (stdout.includes("not-found")) exitCode = 4;
      break;
    case command.startsWith("journalctl -u "):
      stdout = formatLogsForUnit(state, command.replace("journalctl -u ", ""));
      break;
    case command === "nginx -t":
      stdout = formatNginxTest(state);
      break;
    case command === "ss -ltnp":
    case command === "netstat -ltnp":
      stdout = formatListeningPorts(state);
      break;
    case command === "psql connections":
      stdout = formatDbConnections(state);
      break;
    case command === "psql long-transactions":
      stdout = formatLongTransactions(state);
      break;
    case command === "deploy status":
      stdout = formatDeployStatus(state);
      break;
    case command === "curl -f http://localhost/health":
    case command === "curl http://localhost/health":
      resolveIfHealthy(scenario, state, effects);
      if (state.incidentResolved) {
        stdout = '{"status":"ok"}';
      } else {
        exitCode = 22;
        stderr = "curl: (22) The requested URL returned error: 503";
      }
      break;
    case command === "truncate -s 0 /var/log/app.log":
      stdout = truncateAppLog(state, effects);
      break;
    case command === "logrotate -f /etc/logrotate.d/app":
      stdout = rotateAppLog(state, effects);
      break;
    case command === "systemctl restart worker":
      stdout = restartWorker(state, effects);
      break;
    case command === "systemctl restart app":
      stdout = restartApp(state, effects);
      break;
    case command === "systemctl reload nginx":
      stdout = reloadNginx(state, effects);
      break;
    case command === "fix-nginx-upstream":
      stdout = fixNginxUpstream(state, effects);
      break;
    case command === "terminate-idle-transactions":
      stdout = terminateIdleTransactions(state, effects);
      break;
    case command === "tune-db-pool":
      stdout = tuneDbPool(state, effects);
      break;
    case command === "deploy rollback":
      stdout = rollbackDeploy(state, effects);
      break;
    case command.startsWith("kill "):
      stdout = killProcess(state, command, effects);
      if (stdout.includes("No such process")) exitCode = 1;
      break;
    default:
      exitCode = 127;
      stderr = `command not found in simulator: ${command}`;
  }

  resolveIfHealthy(scenario, state, effects);
  return result(state, command, exitCode, stdout, stderr, effects, risk);
}

function normalize(command: string): string {
  return command.trim().replace(/\s+/g, " ");
}

function isDangerous(command: string): boolean {
  return /(^|\s)(rm\s+-rf|mkfs|dd\s+if=|shutdown|reboot|kill\s+-9\s+1|swapoff\s+-a|drop\s+database)/i.test(command);
}

function result(
  state: SimulatedServerState,
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string,
  effects: string[],
  risk: RemediationRisk
): SimulatedCommandExecution {
  return { state, result: { command, exitCode, stdout, stderr, effects }, risk };
}

function helpText(scenario: ScenarioDefinition): string {
  const commands = new Set<string>();
  scenario.skills.flatMap((skill) => skill.commandExamples).forEach((command) => commands.add(command));
  ["help", "curl -f http://localhost/health", "journalctl -u app"].forEach((command) => commands.add(command));
  return `Scenario: ${scenario.title}\nRecommended commands to try:\n${Array.from(commands).map((command) => `  ${command}`).join("\n")}`;
}

function percent(used: number, total: number): number {
  return Math.round((used / total) * 100);
}

function formatDf(disks: DiskVolume[]): string {
  return [
    "Filesystem      Size  Used Avail Use% Mounted on",
    ...disks.map((disk) => {
      const avail = Math.max(0, disk.sizeGb - disk.usedGb);
      return `${disk.filesystem.padEnd(14)} ${`${disk.sizeGb}G`.padStart(4)} ${`${disk.usedGb}G`.padStart(5)} ${`${avail}G`.padStart(5)} ${`${percent(disk.usedGb, disk.sizeGb)}%`.padStart(4)} ${disk.mount}`;
    })
  ].join("\n");
}

function formatDu(logFiles: LogFileState[]): string {
  return logFiles
    .slice()
    .sort((a, b) => b.sizeMb - a.sizeMb)
    .map((file) => `${file.sizeMb >= 1024 ? `${(file.sizeMb / 1024).toFixed(1)}G` : `${file.sizeMb}M`}\t${file.path}`)
    .join("\n");
}

function formatFree(state: SimulatedServerState): string {
  const free = Math.max(0, state.memory.totalMb - state.memory.usedMb);
  return [
    "              total        used        free      shared  buff/cache   available",
    `Mem:       ${state.memory.totalMb.toString().padStart(8)}${state.memory.usedMb.toString().padStart(12)}${free.toString().padStart(12)}         128         512${free.toString().padStart(12)}`,
    `Swap:          2048${state.memory.swapUsedMb.toString().padStart(12)}${(2048 - state.memory.swapUsedMb).toString().padStart(12)}`
  ].join("\n");
}

function formatTop(state: SimulatedServerState): string {
  return [
    `top - load average: ${state.cpu.load1.toFixed(2)}, ${state.cpu.load5.toFixed(2)}, ${state.cpu.load15.toFixed(2)}  CPU: ${state.cpu.utilizationPercent}%`,
    "  PID USER      %CPU   RSS(MB) COMMAND",
    ...state.processes
      .filter((process) => process.status === "running")
      .sort((a, b) => b.cpuPercent - a.cpuPercent)
      .slice(0, 8)
      .map((process) => `${process.pid.toString().padStart(5)} ${process.user.padEnd(9)} ${process.cpuPercent.toFixed(1).padStart(5)} ${process.memoryMb.toString().padStart(8)} ${process.command}`)
  ].join("\n");
}

function formatPs(processes: ProcessState[], sort: "cpu" | "memory"): string {
  const sorted = processes
    .filter((process) => process.status === "running")
    .slice()
    .sort((a, b) => (sort === "cpu" ? b.cpuPercent - a.cpuPercent : b.memoryMb - a.memoryMb));
  return [
    "USER         PID %CPU  RSS(MB) STAT COMMAND",
    ...sorted.map((process) => `${process.user.padEnd(10)} ${process.pid.toString().padStart(5)} ${process.cpuPercent.toFixed(1).padStart(4)} ${process.memoryMb.toString().padStart(8)} R    ${process.command}`)
  ].join("\n");
}

function findService(state: SimulatedServerState, name: ServiceName | string) {
  return state.services.find((service) => service.name === name);
}

function setService(state: SimulatedServerState, name: ServiceName, patch: Partial<NonNullable<ReturnType<typeof findService>>>) {
  const service = findService(state, name);
  if (service) Object.assign(service, patch);
}

function formatServiceStatus(state: SimulatedServerState, name: ServiceName): string {
  const service = findService(state, name);
  if (!service) return `${name}.service - not-found`;
  return `${name}.service - simulated ${name}\n   Loaded: loaded\n   Active: ${service.status === "running" ? "active (running)" : service.status}\n   Port: ${service.port ?? "n/a"}\n   Status: ${service.message}`;
}

function formatLogsForUnit(state: SimulatedServerState, unit: string): string {
  const normalized = unit.replace(".service", "");
  return formatLogs(state.logs.filter((log) => log.source === normalized || (normalized === "app" && log.source === "deploy")));
}

function formatLogs(logs: LogEntry[]): string {
  if (logs.length === 0) return "-- No recent matching logs --";
  return logs.map((log, index) => `May 23 13:${String(40 + index).padStart(2, "0")} web-01 ${log.source}[sim]: ${log.level.toUpperCase()} ${log.message}`).join("\n");
}

function formatNginxTest(state: SimulatedServerState): string {
  const config = state.configFiles.find((file) => file.path.includes("nginx"));
  if (!config?.valid) return "nginx: [emerg] invalid configuration\nnginx: configuration file /etc/nginx/nginx.conf test failed";
  return `nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful\n# ${config.summary}`;
}

function formatListeningPorts(state: SimulatedServerState): string {
  return [
    "State   Local Address:Port  Process",
    ...state.services
      .filter((service) => service.status !== "stopped" && service.port)
      .map((service) => `LISTEN  127.0.0.1:${service.port}      ${service.name}`)
  ].join("\n");
}

function formatDbConnections(state: SimulatedServerState): string {
  const db = state.database;
  return [
    "max_connections active_connections waiting_clients long_transactions slow_queries",
    `${db.maxConnections.toString().padStart(15)} ${db.activeConnections.toString().padStart(18)} ${db.waitingClients.toString().padStart(15)} ${db.longTransactions.toString().padStart(17)} ${db.slowQueries.toString().padStart(12)}`
  ].join("\n");
}

function formatLongTransactions(state: SimulatedServerState): string {
  if (state.database.longTransactions === 0) return "No idle-in-transaction sessions older than 60s.";
  return `pid   state                 age      query\n9142  idle in transaction   22m      UPDATE orders SET ...\n9148  idle in transaction   18m      SELECT * FROM reports ...\n# total: ${state.database.longTransactions}`;
}

function formatDeployStatus(state: SimulatedServerState): string {
  const deploy = state.deployment;
  return [
    `current=${deploy.currentVersion}`,
    `previous=${deploy.previousVersion}`,
    `healthy=${deploy.healthy}`,
    `summary=${deploy.lastDeploySummary}`,
    deploy.envMissing ? `missing_env=${deploy.envMissing}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
}

function truncateAppLog(state: SimulatedServerState, effects: string[]): string {
  const log = state.logFiles.find((file) => file.path === "/var/log/app.log");
  if (log) log.sizeMb = 4;
  const varDisk = state.disks.find((disk) => disk.mount === "/var");
  if (varDisk) varDisk.usedGb = Math.min(varDisk.usedGb, 62);
  setService(state, "app", { status: "running", message: "active (running)" });
  setService(state, "postgresql", { status: "running", message: "active (running)" });
  effects.push("app.log truncation freed /var space");
  return "truncated /var/log/app.log";
}

function rotateAppLog(state: SimulatedServerState, effects: string[]): string {
  const log = state.logFiles.find((file) => file.path === "/var/log/app.log");
  if (log) log.rotated = true;
  effects.push("logrotate config applied");
  return "forced rotation for app logs";
}

function restartWorker(state: SimulatedServerState, effects: string[]): string {
  const worker = state.processes.find((process) => process.command.includes("worker"));
  if (worker) {
    worker.memoryMb = 480;
    worker.cpuPercent = 4.8;
  }
  state.memory.usedMb = 4300;
  state.memory.swapUsedMb = 256;
  setService(state, "worker", { status: "running", message: "active (running); memory reset after restart" });
  setService(state, "app", { status: "running", message: "active (running)" });
  effects.push("worker restarted and memory pressure relieved");
  return "worker.service restarted";
}

function restartApp(state: SimulatedServerState, effects: string[]): string {
  if (state.deployment.envMissing && !state.deployment.healthy) {
    setService(state, "app", { status: "failed", message: `crashloop: missing ${state.deployment.envMissing}` });
    return "app.service restarted but failed: missing required environment variable";
  }
  if (state.database.waitingClients > 0) {
    setService(state, "app", { status: "degraded", message: "database pool timeout" });
    return "app.service restarted but DB pool is still exhausted";
  }
  setService(state, "app", { status: "running", message: "active (running)" });
  effects.push("app service restarted");
  return "app.service restarted";
}

function reloadNginx(state: SimulatedServerState, effects: string[]): string {
  const config = state.configFiles.find((file) => file.path.includes("nginx"));
  if (!config?.valid) return "nginx reload failed: invalid configuration";
  setService(state, "nginx", { status: "running", message: "active (running); config reloaded" });
  effects.push("nginx reloaded");
  return "nginx.service reloaded";
}

function fixNginxUpstream(state: SimulatedServerState, effects: string[]): string {
  const config = state.configFiles.find((file) => file.path.includes("nginx"));
  if (config) config.summary = "proxy_pass http://127.0.0.1:3001; upstream matches app port";
  setService(state, "nginx", { status: "degraded", message: "upstream corrected; reload required" });
  effects.push("nginx upstream changed to app port 3001");
  return "updated /etc/nginx/sites-enabled/app.conf upstream to 127.0.0.1:3001";
}

function terminateIdleTransactions(state: SimulatedServerState, effects: string[]): string {
  state.database.activeConnections = 61;
  state.database.waitingClients = 0;
  state.database.longTransactions = 0;
  effects.push("idle transactions terminated");
  return "terminated 18 idle-in-transaction sessions";
}

function tuneDbPool(state: SimulatedServerState, effects: string[]): string {
  state.database.activeConnections = Math.min(state.database.activeConnections, 48);
  setService(state, "app", { status: "running", message: "active (running); pool max reduced" });
  effects.push("application DB pool reduced");
  return "updated APP_DB_POOL_MAX=20";
}

function rollbackDeploy(state: SimulatedServerState, effects: string[]): string {
  const previous = state.deployment.previousVersion;
  state.deployment.currentVersion = previous;
  state.deployment.healthy = true;
  state.deployment.envMissing = undefined;
  state.deployment.lastDeploySummary = `Rolled back to ${previous}`;
  setService(state, "app", { status: "running", message: `active (running) on ${previous}` });
  effects.push("deployment rolled back to previous healthy version");
  return `rolled back to ${previous}`;
}

function killProcess(state: SimulatedServerState, command: string, effects: string[]): string {
  const pid = Number(command.replace("kill ", ""));
  const process = state.processes.find((item) => item.pid === pid);
  if (!process) return `kill: (${pid}) - No such process`;
  process.status = "stopped";
  if (pid === 3307) {
    state.cpu = { load1: 1.2, load5: 1.8, load15: 2.1, utilizationPercent: 42 };
    setService(state, "app", { status: "running", message: "active (running); latency normal" });
    effects.push("CPU-heavy batch job stopped");
  }
  if (pid === 2205) {
    state.memory.usedMb = 4300;
    state.memory.swapUsedMb = 256;
    setService(state, "worker", { status: "stopped", message: "stopped for leak investigation" });
    setService(state, "app", { status: "running", message: "active (running)" });
    effects.push("leaking worker stopped");
  }
  return `sent SIGTERM to ${pid}`;
}

function resolveIfHealthy(scenario: ScenarioDefinition, state: SimulatedServerState, effects: string[]) {
  let resolved = false;
  switch (scenario.id) {
    case "disk-full": {
      const varDisk = state.disks.find((disk) => disk.mount === "/var");
      resolved = Boolean(varDisk && percent(varDisk.usedGb, varDisk.sizeGb) < 80 && findService(state, "app")?.status === "running" && findService(state, "postgresql")?.status === "running");
      break;
    }
    case "memory-oom":
      resolved = state.memory.usedMb < 6000 && findService(state, "app")?.status === "running";
      break;
    case "cpu-spike":
      resolved = state.cpu.utilizationPercent < 70 && findService(state, "app")?.status === "running";
      break;
    case "nginx-502": {
      const config = state.configFiles.find((file) => file.path.includes("nginx"));
      resolved = Boolean(config?.summary.includes("3001") && findService(state, "nginx")?.status === "running" && findService(state, "app")?.status === "running");
      break;
    }
    case "db-connection-exhaustion":
      resolved = state.database.activeConnections < 75 && state.database.waitingClients === 0 && findService(state, "app")?.status === "running";
      break;
    case "bad-deployment-rollback":
      resolved = state.deployment.healthy && findService(state, "app")?.status === "running";
      break;
  }

  if (resolved && !state.incidentResolved) {
    state.incidentResolved = true;
    state.resolutionSummary = `${scenario.title} 시나리오 해결: 핵심 증상이 정상 범위로 돌아왔습니다.`;
    state.alerts = [{ severity: "info", message: "Incident resolved; health checks are passing" }];
    effects.push("incident marked resolved");
  }
}
