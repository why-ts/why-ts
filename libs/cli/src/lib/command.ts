import {
  Command,
  CommandOutput,
  ExtendedOptions,
  Handler,
  HandlerReplacement,
  Metadata,
} from './command.types';
import { type CommandHelpFormatter } from './config/command-help-formatter';
import defaultHelpFormatter from './config/command-help-formatter.default';
import defaultEnv from './config/env.default';
import defaultLogger from './config/logger.default';
import defaultParser from './config/parser.default';
import defaultPrompter from './config/prompter.default';
import { type Option } from './option.types';
import {
  Aliasable,
  EmptyObject,
  GenericOptions,
  HandlerInput,
  ParsedArgsFromOptions,
  RuntimeConfig,
} from './types';
import { extractAliases, noop } from './util';

export function command(metadata: Metadata = {}): Command {
  return new CommandImpl(noop, {}, metadata);
}

class CommandImpl<
  Options extends GenericOptions = EmptyObject,
  HandlerResult = void
> implements Command<Options, HandlerResult>
{
  constructor(
    private handler: Handler<Options, HandlerResult>,
    public readonly options: Options,
    public readonly metadata: Metadata
  ) {}

  meta(
    metadata: Metadata | ((current: Metadata) => Metadata)
  ): Command<Options, HandlerResult> {
    if (typeof metadata === 'function') metadata = metadata(this.metadata);

    return new CommandImpl(this.handler, this.options, {
      ...this.metadata,
      ...metadata,
    });
  }

  option<N extends string, O extends Option>(
    name: Aliasable<N>,
    option: O
  ): Command<ExtendedOptions<Options, N, O>, HandlerResult> {
    const { name: n, aliases } = extractAliases(name);

    return new CommandImpl(
      this.handler,
      {
        ...this.options,
        [n]: { aliases, value: option },
      } as ExtendedOptions<Options, N, O>,
      this.metadata
    );
  }

  handle<R>(
    handler: HandlerReplacement<Options, HandlerResult, R>
  ): Command<Options, R> {
    return new CommandImpl(
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

  help(formatter: CommandHelpFormatter = defaultHelpFormatter): string {
    return formatter.format(this.metadata, this.options);
  }
}
