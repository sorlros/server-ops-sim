import type { SimulatedServerState } from "../simulation/types";

export type ScenarioId =
  | "disk-full"
  | "memory-oom"
  | "cpu-spike"
  | "nginx-502"
  | "db-connection-exhaustion"
  | "bad-deployment-rollback";

export type ScenarioDifficulty = "beginner" | "intermediate" | "advanced";

export interface ScenarioSkill {
  label: string;
  commandExamples: string[];
}

export interface ScenarioDefinition {
  id: ScenarioId;
  title: string;
  difficulty: ScenarioDifficulty;
  synopsis: string;
  initialAlert: string;
  learningGoals: string[];
  skills: ScenarioSkill[];
  successCriteria: string[];
  recommendedPath: string[];
  dangerousActions: string[];
  hints: string[];
  initialState: SimulatedServerState;
}

export interface ScenarioListItem {
  id: ScenarioId;
  title: string;
  difficulty: ScenarioDifficulty;
  synopsis: string;
  initialAlert: string;
  learningGoals: string[];
}
