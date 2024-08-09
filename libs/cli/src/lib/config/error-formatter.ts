export interface ErrorFormatter {
  format(error: Error): string;
}
