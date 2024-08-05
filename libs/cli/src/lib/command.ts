import minimist from 'minimist';
import { camelCase } from 'change-case';
import { P, match } from 'ts-pattern';
import { CamelCase } from 'type-fest';
import defaultLogger from './config/logger';
import defaultHelpFormatter, { type HelpFormatter } from './command.formatter';
import { UsageError } from './error';
import { TYPE, type Option, type OptionChoicesVariant } from './option.types';
import defaultPrompter from './config/prompter';
import defaultEnv from './config/env';
import {
  CommandOutput,
  EmptyObject,
  GenericOptions,
  HandlerInput,
  CommandMeta as Meta,
  MetaArgs,
  ParsedArgsFromOptions,
  RuntimeConfig,
} from './types';
import { FALSY } from './constant';

export function command(metadata: Metadata = {}) {
  return new Command(noop, {}, metadata);
}

export class Command<
  Options extends GenericOptions = EmptyObject,
  HandlerResult = void
> {
  constructor(
    private handler: Handler<Options, HandlerResult>,
    public readonly options: Options,
    public readonly metadata: Metadata
  ) {}

  meta(
    metadata: Metadata | ((current: Metadata) => Metadata)
  ): Command<Options, HandlerResult> {
    if (typeof metadata === 'function') metadata = metadata(this.metadata);

    return new Command(this.handler, this.options, {
      ...this.metadata,
      ...metadata,
    });
  }

  option<N extends string, O extends Option>(
    name: N,
    o: O
  ): Command<Options & { [K in CamelCase<N>]: O }, HandlerResult> {
    return new Command(
      this.handler,
      { ...this.options, [name]: o } as Options & {
        [K in CamelCase<N>]: O;
      },
      this.metadata
    );
  }

  handle<R>(
    handler: HandlerReplacement<Options, HandlerResult, R>
  ): Command<Options, R> {
    return new Command(
      (input: HandlerInput<ParsedArgsFromOptions<Options>>) =>
        handler({ ...input, current: this.handler }),
      this.options,
      this.metadata
    );
  }

  async run(
    argv: string[],
    config?: RuntimeConfig
  ): Promise<CommandOutput<Options, HandlerResult>> {
    type FullArgs = ParsedArgsFromOptions<Options> & MetaArgs;

    const {
      logger = defaultLogger,
      prompter = defaultPrompter,
      env = defaultEnv,
    } = {
      ...this.metadata,
      ...config,
    };

    const parsed = minimist(argv, {
      string: Object.entries(this.options)
        .filter(([, v]) => v[TYPE].startsWith('string')) // force minimist to parse input as string
        .map(([k]) => k),
    });

    const args: FullArgs = { _: parsed._ } as FullArgs;
    const errors: string[] = [];
    for (const rawKey in this.options) {
      const camelKey = camelCase(rawKey) as keyof Options;
      const option = this.options[rawKey];
      const { fallback, required } = option;

      let value = parsed[rawKey];

      // try env var if value is undefined
      if (value === undefined && option.env) {
        value = env.get(option.env);
      }

      // invoke fallback if value is still undefined
      if (value === undefined && fallback) {
        value = fallback();
      }

      // throw if required value is still undefined after fallback
      if (value === undefined && required) {
        errors.push(`--${rawKey} is required`);
      }

      // validate value
      if (value !== undefined) {
        match(validate(rawKey, value, option))
          .with({ success: false }, ({ error }) => errors.push(error))
          .with({ success: true }, ({ value }) => (args[camelKey] = value))
          .exhaustive();
      }
    }

    if (errors.length > 0) {
      throw new UsageError('RUNTIME_ERROR', errors.join('\n'));
    }

    const result = await this.handler({ args, argv, logger, prompter });
    return { args, result };
  }

  help(formatter: HelpFormatter = defaultHelpFormatter): string {
    return formatter(this.metadata, this.options);
  }
}
// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}

type Validation =
  | { success: true; value: any }
  | { success: false; error: string };

function validate(key: string, value: any, option: Option): Validation {
  const fail = (error: string): Validation => ({ success: false, error });
  const ok = (value: any): Validation => ({ success: true, value });

  const expected = option[TYPE];
  const actual = match(typeof value)
    .with('object', () => (Array.isArray(value) ? 'array' : 'object'))
    .otherwise((type) => type);

  return match([expected, actual])
    .with(['number', 'number'], () => ok(value))
    .with(['number', 'string'], () => {
      const num = Number(value);
      return isNaN(num)
        ? fail(`--${key} must be a number but got ${value}`)
        : ok(num);
    })

    .with(['number-array', 'number'], () => ok([value]))
    .with(['number-array', 'array'], () =>
      match(value.filter((v: unknown) => typeof v !== 'number' || isNaN(v)))
        .with([], () => ok(value))
        .otherwise((nonNumbers) =>
          fail(`--${key} must be an number but got [${nonNumbers.join(', ')}]`)
        )
    )

    .with(['boolean', 'string'], () => ok(!FALSY.includes(value.toLowerCase())))
    .with(['boolean', 'number'], () => ok(value !== 0))
    .with(['boolean', 'boolean'], () => ok(value))

    .with(['string', 'string'], () => ok(value))

    .with(['string-array', 'string'], () => ok([value]))
    .with(['string-array', 'array'], () => ok(value.map(String)))

    .with(['string-choices', 'string'], () => {
      const { choices } = option as OptionChoicesVariant;
      return choices.includes(value)
        ? ok(value)
        : fail(
            `--${key} must be one of [${choices.join(', ')}], but got ${value}`
          );
    })
    .with(
      [P.union('number', 'boolean', 'string', 'string-choices'), 'array'],
      () =>
        fail(
          `--${key} only accepts a single value but is specified multiple times with values: ` +
            `[${value.join(', ')}]`
        )
    )
    .otherwise(([expected, actual]) =>
      fail(`--${key} must be a ${expected} but got ${value} (${actual})`)
    );
}

type Metadata = Meta & RuntimeConfig;
type Handler<O extends GenericOptions, R> = (
  input: HandlerInput<ParsedArgsFromOptions<O>>
) => R;
type HandlerReplacement<O extends GenericOptions, R1, R2> = (
  input: HandlerInput<ParsedArgsFromOptions<O>> & {
    current: Handler<O, R1>;
  }
) => R2;
