export type RemediationRisk = "safe" | "risky" | "dangerous";

export interface ActionRecord {
  command: string;
  exitCode: number;
  effects: string[];
  risk: RemediationRisk;
  at: string;
}
