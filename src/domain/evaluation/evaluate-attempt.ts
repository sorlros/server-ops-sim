import type { Evaluation } from "./types";
import type { ActionRecord } from "../remediation/types";
import type { SimulatedServerState } from "../simulation/types";

interface EvaluateAttemptInput {
  state: SimulatedServerState;
  history: ActionRecord[];
  usedHints: number;
}

export function evaluateAttempt({ state, history, usedHints }: EvaluateAttemptInput): Evaluation {
  const dangerousCount = history.filter((item) => item.risk === "dangerous").length;
  const failedCount = history.filter((item) => item.exitCode !== 0).length;
  const base = state.incidentResolved ? 100 : 35;
  const score = Math.max(0, Math.min(100, base - usedHints * 8 - dangerousCount * 25 - failedCount * 3 - Math.max(0, history.length - 8) * 2));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 65 ? "C" : score >= 50 ? "D" : "F";

  return {
    resolved: state.incidentResolved,
    score,
    grade,
    summary: state.incidentResolved
      ? state.resolutionSummary ?? "장애가 해결되었고 서비스 health check가 정상화되었습니다."
      : "아직 장애가 완전히 해결되지 않았습니다. 관측 명령으로 원인을 좁힌 뒤 안전한 조치를 적용하세요.",
    positives: [
      state.incidentResolved ? "서비스 정상화 조건을 충족했습니다." : "시뮬레이션을 진행 중입니다.",
      history.some((item) => item.command.includes("journalctl") || item.command.includes("top") || item.command.includes("df") || item.command.includes("psql"))
        ? "관측 명령을 사용해 상태를 확인했습니다."
        : "관측 명령을 먼저 사용하면 점검 품질이 좋아집니다."
    ],
    improvements: [
      usedHints > 0 ? "다음 시도에서는 힌트 없이 원인 후보를 좁혀보세요." : "힌트 없이 진행했습니다.",
      dangerousCount > 0 ? "위험 명령은 실제 운영에서 승인/백업/영향도 확인 후 수행해야 합니다." : "위험한 조치를 피했습니다."
    ]
  };
}
