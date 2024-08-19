export type Logger = {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
};
