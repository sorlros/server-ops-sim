import { beforeEach, describe, expect, it } from "vitest";
import { clearAttemptsForTests } from "@/infrastructure/attempt-store/in-memory-attempt-store";
import { executeCommand, listScenarioCatalog, startScenario, useHint } from "@/application/usecases/scenario-usecases";

beforeEach(() => clearAttemptsForTests());

describe("scenario use cases", () => {
  it("lists the six MVP scenarios", () => {
    const scenarios = listScenarioCatalog();
    expect(scenarios).toHaveLength(6);
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "disk-full",
      "memory-oom",
      "cpu-spike",
      "nginx-502",
      "db-connection-exhaustion",
      "bad-deployment-rollback"
    ]);
  });

  it("starts an attempt and records command history", () => {
    const started = startScenario("cpu-spike");
    expect(started.attempt.history).toHaveLength(0);
    expect(started.attempt.state.incidentResolved).toBe(false);

    const afterTop = executeCommand(started.attempt.id, "top");
    expect(afterTop.attempt.history).toHaveLength(1);
    expect(afterTop.attempt.lastCommand?.stdout).toContain("load average");
  });

  it("resolves DB connection exhaustion with the recommended remediation path", () => {
    const started = startScenario("db-connection-exhaustion");
    const observed = executeCommand(started.attempt.id, "psql connections");
    expect(observed.attempt.lastCommand?.stdout).toContain("99");

    const terminated = executeCommand(started.attempt.id, "terminate-idle-transactions");
    const tuned = executeCommand(terminated.attempt.id, "tune-db-pool");
    expect(tuned.attempt.state.incidentResolved).toBe(true);
    expect(tuned.evaluation.score).toBeGreaterThanOrEqual(80);
  });

  it("applies hint penalty", () => {
    const started = startScenario("bad-deployment-rollback");
    const hinted = useHint(started.attempt.id);
    expect(hinted.hint).toBeTruthy();
    expect(hinted.evaluation.score).toBeLessThan(started.evaluation.score);
  });
});
