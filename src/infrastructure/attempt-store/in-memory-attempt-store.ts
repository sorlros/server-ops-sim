import type { AttemptSession } from "@/application/usecases/types";

declare global {
  // eslint-disable-next-line no-var
  var __serverOpsAttempts: Map<string, AttemptSession> | undefined;
}

function store(): Map<string, AttemptSession> {
  if (!globalThis.__serverOpsAttempts) {
    globalThis.__serverOpsAttempts = new Map<string, AttemptSession>();
  }
  return globalThis.__serverOpsAttempts;
}

export function saveAttempt(attempt: AttemptSession): AttemptSession {
  store().set(attempt.id, attempt);
  return attempt;
}

export function getAttempt(id: string): AttemptSession | undefined {
  return store().get(id);
}

export function clearAttemptsForTests(): void {
  store().clear();
}
