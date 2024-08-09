import { P, match } from 'ts-pattern';
import { Command } from './command';
import defaultArgvFormatter from './config/argv-formatter.default';
import defaultErrorFormatter from './config/error-formatter.default';
import defaultLogger from './config/logger.default';
import { type ProgramHelpFormatter } from './config/program-help-formatter';
import defaultHelpFormatter from './config/program-help-formatter.default';
import { CommandNotFoundError, UsageError } from './error';
import {
  CommandOutput,
  EmptyObject,
  ProgramMeta,
  RuntimeConfig,
} from './types';

export function program(metadata: ProgramMeta & RuntimeConfig = {}) {
  return new Program({}, metadata);
}

class Program<Commands extends GenericCommands = EmptyObject> {
  constructor(
    public commands: Commands,
    public readonly metadata: ProgramMeta & RuntimeConfig
  ) {}

  public outputs: Output<Commands> = {} as any;

  command<Name extends string, Cmd extends Command<any, any>>(
    name: Name,
    command: Cmd
  ): Program<
    Commands & {
      [N in Name]: Cmd;
    }
  > {
    return new Program(
      { ...this.commands, [name]: command } as Commands & {
        [N in Name]: Cmd;
      },
      this.metadata
    );
  }

  async run(argv: string[], config?: RuntimeConfig): Promise<Output<Commands>> {
    const mergedConfig = { ...this.metadata, ...config };
    const {
      logger = defaultLogger,
      shouldTriggerHelp = defaultShouldTriggerHelpForProgram,
      argvFormatter = defaultArgvFormatter,
      errorFormatter = defaultErrorFormatter,
    } = mergedConfig;

    const name = argv[0];
    const command = this.commands[name];

    try {
      if (argv.length === 0)
        throw new UsageError('COMMAND_MISSING', 'No command provided');

      logger.error(argvFormatter.format(argv) + '\n');

      if (shouldTriggerHelp(argv)) {
        // show global help
        logger.error(this.help());
        return { kind: 'help' };
      } else {
        if (!command) {
          throw new CommandNotFoundError(name);
        }
        return await this.runCommand({
          name,
          argv: argv.slice(1),
          command,
          config: mergedConfig,
        });
      }
    } catch (e) {
      if (e instanceof Error) {
        logger.error(errorFormatter.format(e));
      }

      if (e instanceof UsageError) {
        if (command) logger.error(command.help());
        else logger.error(this.help());
      }
      throw e;
    }
  }

  help(formatter: ProgramHelpFormatter = defaultHelpFormatter) {
    return formatter.format(this.metadata, this.commands);
  }

  private async runCommand({
    name,
    argv,
    command,
    config,
  }: {
    name: string;
    argv: string[];
    command: Command<any, any>;
    config: RuntimeConfig;
  }): Promise<Output<Commands>> {
    const {
      shouldTriggerHelp = defaultShouldTriggerHelpForCommand,
      logger = defaultLogger,
    } = { ...command.metadata, ...config };

    if (shouldTriggerHelp(argv)) {
      // show command help
      logger.error(command.help());
      return { kind: 'help' };
    } else {
      const output = await command.run(argv, config);
      return {
        kind: 'command',
        command: name,
        ...output,
      } as Output<Commands>;
    }
  }
}

function defaultShouldTriggerHelpForProgram(argv: string[]): boolean {
  return match(argv)
    .with([P.union('help', '--help', '-h')], () => true)
    .otherwise(() => false);
}

function defaultShouldTriggerHelpForCommand(argv: string[]): boolean {
  return match(argv)
    .with([P.union('--help', '-h')], () => true)
    .otherwise(() => false);
}

type GenericCommands = { readonly [K: string]: Command<any, any> };

type Output<Commands extends GenericCommands> =
  | ({ kind: 'command' } & UnionFromRecord<{
      [CommandName in keyof Commands]: InferCommandOutput<
        Commands[CommandName]
      >;
    }>)
  | { kind: 'help' };

type InferCommandOutput<C extends Command<any, any>> = C extends Command<
  infer O,
  infer R
>
  ? CommandOutput<O, R>
  : never;

type StringKeyOf<O extends Record<string, any>> = keyof O;
type UnionFromRecord<O extends Record<string, any>> = {
  [K in StringKeyOf<O>]: O[K] & { command: K };
}[StringKeyOf<O>];
