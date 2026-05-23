export type ServiceName = "nginx" | "app" | "postgresql" | "redis" | "worker";
export type ServiceStatus = "running" | "degraded" | "failed" | "stopped";
export type AlertSeverity = "info" | "warning" | "critical";

export interface DiskVolume {
  filesystem: string;
  mount: string;
  sizeGb: number;
  usedGb: number;
}

export interface LogFileState {
  path: string;
  sizeMb: number;
  owner: string;
  rotated: boolean;
}

export interface MemoryState {
  totalMb: number;
  usedMb: number;
  swapUsedMb: number;
  oomKills: number;
}

export interface CpuState {
  load1: number;
  load5: number;
  load15: number;
  utilizationPercent: number;
}

export interface ProcessState {
  pid: number;
  user: string;
  command: string;
  cpuPercent: number;
  memoryMb: number;
  status: "running" | "sleeping" | "stopped";
}

export interface ServiceState {
  name: ServiceName;
  status: ServiceStatus;
  port?: number;
  message: string;
}

export interface DatabaseState {
  engine: "postgresql";
  maxConnections: number;
  activeConnections: number;
  waitingClients: number;
  longTransactions: number;
  slowQueries: number;
}

export interface DeploymentState {
  currentVersion: string;
  previousVersion: string;
  healthy: boolean;
  lastDeploySummary: string;
  envMissing?: string;
}

export interface ConfigFileState {
  path: string;
  valid: boolean;
  summary: string;
}

export interface AlertState {
  severity: AlertSeverity;
  message: string;
}

export interface LogEntry {
  source: ServiceName | "kernel" | "deploy" | "system";
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

export interface SimulatedServerState {
  hostname: string;
  incidentResolved: boolean;
  resolutionSummary?: string;
  disks: DiskVolume[];
  logFiles: LogFileState[];
  memory: MemoryState;
  cpu: CpuState;
  processes: ProcessState[];
  services: ServiceState[];
  database: DatabaseState;
  deployment: DeploymentState;
  configFiles: ConfigFileState[];
  alerts: AlertState[];
  logs: LogEntry[];
}

export function cloneServerState(state: SimulatedServerState): SimulatedServerState {
  return structuredClone(state);
}
