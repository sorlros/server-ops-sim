import type { ScenarioDefinition, ScenarioId, ScenarioListItem } from "@/domain/scenario/types";
import type { SimulatedServerState } from "@/domain/simulation/types";
import type { CommandResult } from "@/domain/observation/types";
import type { ActionRecord } from "@/domain/remediation/types";
import type { Evaluation } from "@/domain/evaluation/types";

export interface AttemptSession {
  id: string;
  scenarioId: ScenarioId;
  startedAt: string;
  updatedAt: string;
  state: SimulatedServerState;
  history: ActionRecord[];
  usedHints: string[];
  lastCommand?: CommandResult;
}

export interface AttemptSnapshot {
  attempt: AttemptSession;
  scenario: ScenarioDefinition;
  evaluation: Evaluation;
}

export interface ScenarioCatalog {
  list(): ScenarioListItem[];
  get(id: ScenarioId | string): ScenarioDefinition | undefined;
}
