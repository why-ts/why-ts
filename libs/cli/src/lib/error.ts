import { match } from 'ts-pattern';

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

export class CommandNotFoundError extends UsageError {
  constructor(public readonly command: string) {
    super('COMMAND_NOT_FOUND', `Command "${command}" not found`);
  }
}

export class InvalidArgsError extends UsageError {
  constructor(public readonly problems: ArgProblem[]) {
    super(
      'INVALID_ARGS',
      problems
        .map((p) =>
          match(p)
            .with({ kind: 'required' }, (v) => `--${v.option} is required`)
            .with(
              { kind: 'custom-validation' },
              (v) => !v.message,
              (v) => `--${v.option} is invalid`
            )
            .otherwise((v) => `--${v.option} ${v.message}`)
        )
        .join('\n')
    );
  }
}

export type ArgProblem = { option: string } & (
  | { kind: 'required' }
  | { kind: 'validation'; message: string }
  | { kind: 'custom-validation'; message?: string }
);
