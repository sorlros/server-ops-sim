export interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  effects: string[];
}
