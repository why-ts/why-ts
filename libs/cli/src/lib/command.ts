import { CamelCase } from 'type-fest';
import defaultHelpFormatter, { type HelpFormatter } from './command.formatter';
import defaultEnv from './config/env.default';
import defaultLogger from './config/logger.default';
import defaultParser from './config/parser.default';
import defaultPrompter from './config/prompter.default';
import { type Option } from './option.types';
import {
  CommandOutput,
  CommandMeta as Meta,
  EmptyObject,
  GenericOptions,
  HandlerInput,
  MetaArgs,
  ParsedArgsFromOptions,
  RuntimeConfig,
} from './types';
import { noop } from './util';

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
    name: N | { name: N; aliases: string[] },
    spec: O
  ): Command<
    Options & { [K in CamelCase<N>]: { aliases: string[]; spec: O } },
    HandlerResult
  > {
    const n = typeof name === 'string' ? name : name.name;
    const aliases = typeof name === 'string' ? [] : name.aliases;

    return new Command(
      this.handler,
      { ...this.options, [n]: { spec, aliases } } as Options & {
        [K in CamelCase<N>]: { aliases: string[]; spec: O };
      },
      this.metadata
    );
  }

  handle<R>(
    handler: HandlerReplacement<Options, HandlerResult, R>
  ): Command<Options, R> {
    return new Command(
      (input: HandlerInput<ParsedArgsFromOptions<Options>>) =>
        handler(input, this.handler),
      this.options,
      this.metadata
    );
  }

  async run(
    argv: string[],
    config?: RuntimeConfig
  ): Promise<CommandOutput<Options, HandlerResult>> {
    const {
      logger = defaultLogger,
      prompter = defaultPrompter,
      env = defaultEnv,
      parser = defaultParser,
    } = {
      ...this.metadata,
      ...config,
    };

    const args = await parser.parse(this.options, argv, env);
    const result = await this.handler({ args, argv, logger, prompter });
    return { args, result };
  }

  help(formatter: HelpFormatter = defaultHelpFormatter): string {
    return formatter(this.metadata, this.options);
  }
}

type Metadata = Meta & RuntimeConfig;
type Handler<O extends GenericOptions, R> = (
  input: HandlerInput<ParsedArgsFromOptions<O>>
) => R;
type HandlerReplacement<O extends GenericOptions, R1, R2> = (
  input: HandlerInput<ParsedArgsFromOptions<O>>,
  current: Handler<O, R1>
) => R2;
