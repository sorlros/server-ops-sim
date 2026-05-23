import { randomUUID } from "node:crypto";
import { evaluateAttempt } from "@/domain/evaluation/evaluate-attempt";
import type { ScenarioId } from "@/domain/scenario/types";
import type { AttemptSession, AttemptSnapshot } from "./types";
import { executeSimulatedCommand } from "@/infrastructure/simulation-engine/command-engine";
import { getScenario, listScenarios } from "@/infrastructure/scenario-repository/scenarios";
import { getAttempt, saveAttempt } from "@/infrastructure/attempt-store/in-memory-attempt-store";

export function listScenarioCatalog() {
  return listScenarios();
}

export function startScenario(scenarioId: ScenarioId | string): AttemptSnapshot {
  const scenario = getScenario(scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);

  const now = new Date().toISOString();
  const attempt: AttemptSession = {
    id: randomUUID(),
    scenarioId: scenario.id,
    startedAt: now,
    updatedAt: now,
    state: structuredClone(scenario.initialState),
    history: [],
    usedHints: []
  };

  saveAttempt(attempt);
  return toSnapshot(attempt);
}

export function loadAttempt(attemptId: string): AttemptSnapshot {
  const attempt = getAttempt(attemptId);
  if (!attempt) throw new Error(`Unknown attempt: ${attemptId}`);
  return toSnapshot(attempt);
}

export function executeCommand(attemptId: string, command: string): AttemptSnapshot {
  const attempt = getAttempt(attemptId);
  if (!attempt) throw new Error(`Unknown attempt: ${attemptId}`);
  const scenario = getScenario(attempt.scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${attempt.scenarioId}`);

  const execution = executeSimulatedCommand(scenario, attempt.state, command);
  const updated: AttemptSession = {
    ...attempt,
    state: execution.state,
    updatedAt: new Date().toISOString(),
    lastCommand: execution.result,
    history: [
      ...attempt.history,
      {
        command: execution.result.command,
        exitCode: execution.result.exitCode,
        effects: execution.result.effects,
        risk: execution.risk,
        at: new Date().toISOString()
      }
    ]
  };
  saveAttempt(updated);
  return toSnapshot(updated);
}

export function useHint(attemptId: string): AttemptSnapshot & { hint?: string } {
  const attempt = getAttempt(attemptId);
  if (!attempt) throw new Error(`Unknown attempt: ${attemptId}`);
  const scenario = getScenario(attempt.scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${attempt.scenarioId}`);

  const hint = scenario.hints[Math.min(attempt.usedHints.length, scenario.hints.length - 1)];
  const updated = {
    ...attempt,
    usedHints: hint && !attempt.usedHints.includes(hint) ? [...attempt.usedHints, hint] : attempt.usedHints,
    updatedAt: new Date().toISOString()
  };
  saveAttempt(updated);
  return { ...toSnapshot(updated), hint };
}

function toSnapshot(attempt: AttemptSession): AttemptSnapshot {
  const scenario = getScenario(attempt.scenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${attempt.scenarioId}`);
  return {
    attempt,
    scenario,
    evaluation: evaluateAttempt({ state: attempt.state, history: attempt.history, usedHints: attempt.usedHints.length })
  };
}
