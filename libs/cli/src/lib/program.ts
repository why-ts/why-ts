import { P, match } from 'ts-pattern';
import { Command, GenericCommands } from './command.types';
import defaultArgvFormatter from './config/argv-formatter.default';
import defaultErrorFormatter from './config/error-formatter.default';
import defaultLogger from './config/logger.default';
import { type ProgramHelpFormatter } from './config/program-help-formatter';
import defaultHelpFormatter from './config/program-help-formatter.default';
import { CommandNotFoundError, UsageError } from './error';
import { ExtendedCommands, Program, ProgramOutput } from './program.types';
import {
  Aliasable,
  EmptyObject,
  GenericOptions,
  ProgramMeta,
  RuntimeConfig,
} from './types';
import { extractAliases } from './util';

export function program(metadata: ProgramMeta & RuntimeConfig = {}): Program {
  return new ProgramImpl({}, metadata);
}

class ProgramImpl<Commands extends GenericCommands = EmptyObject>
  implements Program<Commands>
{
  constructor(
    public readonly commands: Commands,
    public readonly metadata: ProgramMeta & RuntimeConfig
  ) {}

  command<N extends string, C extends Command<any, unknown>>(
    name: Aliasable<N>,
    command: C
  ): Program<ExtendedCommands<Commands, N, C>> {
    const { name: n, aliases } = extractAliases(name);

    return new ProgramImpl(
      {
        ...this.commands,
        [n]: { aliases, value: command },
      } as ExtendedCommands<Commands, N, C>,
      this.metadata
    );
  }

  async run(
    argv: string[],
    config?: RuntimeConfig
  ): Promise<ProgramOutput<Commands>> {
    const mergedConfig = { ...this.metadata, ...config };
    const {
      logger = defaultLogger,
      shouldTriggerHelp = defaultShouldTriggerHelpForProgram,
      argvFormatter = defaultArgvFormatter,
      errorFormatter = defaultErrorFormatter,
    } = mergedConfig;

    const handleError = (e: unknown, command?: Command<any, unknown>) => {
      if (e instanceof Error) {
        logger.error(errorFormatter.format(e));
      }

      if (e instanceof UsageError) {
        logger.log(command ? command.help() : this.help());
      }
      return e;
    };

    try {
      if (argv.length === 0)
        throw handleError(
          new UsageError('COMMAND_MISSING', 'No command provided')
        );

      logger.error(argvFormatter.format(argv) + '\n');

      if (shouldTriggerHelp(argv)) {
        // show global help
        logger.log(this.help());
        return { kind: 'help' };
      } else {
        const { name, command } = this.lookupCommand(argv[0]);

        if (!command) {
          throw new CommandNotFoundError(argv[0]);
        }

        return await this.runCommand({
          name,
          argv: argv.slice(1),
          command,
          config: mergedConfig,
        });
      }
    } catch (e) {
      throw handleError(e);
    }
  }

  help(formatter: ProgramHelpFormatter = defaultHelpFormatter) {
    return formatter.format(this.metadata, this.commands);
  }

  private lookupCommand(name: string): {
    name: string;
    command?: Command<any, unknown>;
    alias?: string;
  } {
    const command = this.commands[name];
    if (command) return { name, command: command.value };

    const aliased = Object.entries(this.commands).find(([, v]) =>
      v.aliases.includes(name)
    );

    if (aliased)
      return { name: aliased[0], command: aliased[1].value, alias: name };

    return { name };
  }

  private async runCommand({
    name,
    argv,
    command,
    config,
  }: {
    name: string;
    argv: string[];
    command: Command<any, unknown>;
    config: RuntimeConfig;
  }): Promise<ProgramOutput<Commands>> {
    const {
      shouldTriggerHelp = defaultShouldTriggerHelpForCommand,
      logger = defaultLogger,
    } = { ...command.metadata, ...config };

    if (shouldTriggerHelp(argv)) {
      // show command help
      logger.log(command.help());
      return { kind: 'help' };
    } else {
      const output = await command.run(argv, config);
      return {
        kind: 'command',
        command: name,
        ...output,
      } as ProgramOutput<Commands>;
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
