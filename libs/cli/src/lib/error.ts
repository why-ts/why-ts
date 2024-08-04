type UsageErrorType =
  | 'COMMAND_NOT_FOUND'
  | 'COMMAND_MISSING'
  | 'INVALID_ARGS'
  | 'RUNTIME_ERROR';

export class UsageError extends Error {
  constructor(public readonly type: UsageErrorType, message: string) {
    super(message);
    this.name = 'UsageError';
  }
}
