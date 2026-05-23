export interface Evaluation {
  resolved: boolean;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  positives: string[];
  improvements: string[];
}
