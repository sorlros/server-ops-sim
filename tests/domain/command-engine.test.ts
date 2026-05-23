import { describe, expect, it } from "vitest";
import { executeSimulatedCommand } from "@/infrastructure/simulation-engine/command-engine";
import { getScenario } from "@/infrastructure/scenario-repository/scenarios";

function scenario(id: string) {
  const definition = getScenario(id);
  if (!definition) throw new Error(`Missing scenario ${id}`);
  return definition;
}

describe("command engine", () => {
  it("diagnoses and resolves disk full with safe log cleanup", () => {
    const diskFull = scenario("disk-full");
    const df = executeSimulatedCommand(diskFull, diskFull.initialState, "df -h");
    expect(df.result.stdout).toContain("/var");
    expect(df.result.stdout).toContain("98%");
    expect(df.state.incidentResolved).toBe(false);

    const du = executeSimulatedCommand(diskFull, df.state, "du -sh /var/log/*");
    expect(du.result.stdout).toContain("/var/log/app.log");

    const truncate = executeSimulatedCommand(diskFull, du.state, "truncate -s 0 /var/log/app.log");
    expect(truncate.state.disks.find((disk) => disk.mount === "/var")?.usedGb).toBeLessThan(80);
    expect(truncate.state.incidentResolved).toBe(true);
  });

  it("blocks destructive commands", () => {
    const diskFull = scenario("disk-full");
    const execution = executeSimulatedCommand(diskFull, diskFull.initialState, "rm -rf /var/log");
    expect(execution.risk).toBe("dangerous");
    expect(execution.result.exitCode).toBe(2);
    expect(execution.state.incidentResolved).toBe(false);
  });

  it("resolves nginx upstream mismatch only after config fix", () => {
    const nginx = scenario("nginx-502");
    const ports = executeSimulatedCommand(nginx, nginx.initialState, "ss -ltnp");
    expect(ports.result.stdout).toContain("3001");

    const fix = executeSimulatedCommand(nginx, ports.state, "fix-nginx-upstream");
    expect(fix.state.incidentResolved).toBe(false);
    const reload = executeSimulatedCommand(nginx, fix.state, "systemctl reload nginx");
    expect(reload.state.incidentResolved).toBe(true);
  });
});
