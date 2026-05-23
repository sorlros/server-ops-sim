import { describe, expect, it } from "vitest";
import { createInitialState, getScenario, listScenarios } from "@/infrastructure/scenario-repository/scenarios";

describe("scenario repository", () => {
  it("loads all MVP scenarios from JSON seed data", () => {
    const scenarios = listScenarios();

    expect(scenarios).toHaveLength(6);
    expect(scenarios.map((scenario) => scenario.id)).toContain("disk-full");
    expect(getScenario("disk-full")?.recommendedPath).toContain("df -h");
  });

  it("returns cloned initial state so attempts cannot mutate the seed", () => {
    const first = createInitialState("disk-full");
    const second = createInitialState("disk-full");

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    first!.disks[1].usedGb = 1;

    expect(second!.disks[1].usedGb).toBe(98);
    expect(getScenario("disk-full")?.initialState.disks[1].usedGb).toBe(98);
  });
});
