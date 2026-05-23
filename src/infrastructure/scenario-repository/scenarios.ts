import type { ScenarioDefinition, ScenarioId, ScenarioListItem } from "@/domain/scenario/types";
import type { SimulatedServerState } from "@/domain/simulation/types";
import { cloneServerState } from "@/domain/simulation/types";
import scenarioSeeds from "./seeds/scenarios.seed.json";

export const scenarios: ScenarioDefinition[] = validateScenarioSeeds(scenarioSeeds as ScenarioDefinition[]);

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

function validateScenarioSeeds(seeds: ScenarioDefinition[]): ScenarioDefinition[] {
  const seen = new Set<string>();

  for (const scenario of seeds) {
    if (seen.has(scenario.id)) {
      throw new Error(`Duplicate scenario seed id: ${scenario.id}`);
    }
    seen.add(scenario.id);

    assertNonEmpty(scenario.title, scenario.id, "title");
    assertNonEmpty(scenario.initialAlert, scenario.id, "initialAlert");
    assertNonEmpty(scenario.synopsis, scenario.id, "synopsis");

    if (!scenario.initialState?.hostname || !Array.isArray(scenario.initialState.services)) {
      throw new Error(`Invalid initial state for scenario seed: ${scenario.id}`);
    }
  }

  return seeds;
}

function assertNonEmpty(value: string, id: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`Scenario seed ${id} is missing ${field}`);
  }
}
