import { P, match } from 'ts-pattern';
import { Command } from './command';
import defaultLogger from './config/logger';
import { UsageError } from './error';
import defaultHelpFormatter, { type HelpFormatter } from './program.formatter';
import {
  CommandOutput,
  EmptyObject,
  ProgramMeta as Meta,
  RuntimeConfig,
} from './types';

export function program(meta: Meta & RuntimeConfig = {}) {
  return new Program({}, meta);
}

class Program<Commands extends GenericCommands = EmptyObject> {
  constructor(
    public commands: Commands,
    public readonly meta: Meta & RuntimeConfig
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
      this.meta
    );
  }

  async run(argv: string[], config?: RuntimeConfig): Promise<Output<Commands>> {
    const mergedConfig = { ...this.meta, ...config };
    const { logger = defaultLogger } = mergedConfig;

    const name = argv[0];
    const command = this.commands[name];

    try {
      if (argv.length === 0)
        throw new UsageError('COMMAND_MISSING', 'No command provided');

      logger.log(`> ${argv.join(' ')}\n`);
      return await match<string[], Promise<Output<Commands>>>(argv)
        .with([P.union('help', '--help', '-h')], async () => {
          // show global help
          logger.log(this.help());
          return { kind: 'help' };
        })
        .otherwise(async () => {
          if (!command) {
            throw new UsageError(
              'COMMAND_NOT_FOUND',
              `Command "${name}" not found`
            );
          }
          return await this.runCommand({
            name,
            argv: argv.slice(1),
            command,
            config: mergedConfig,
          });
        });
    } catch (e) {
      if (e instanceof UsageError) {
        if (command) logger.log(command.help());
        else logger.log(this.help());
      }

      if (command && e instanceof Error) {
        logger.error(`\n========== ERROR ==========\n`);
        logger.error(`Failed to run command:`);
        logger.error(`> ${argv.join(' ')}`);
        if (e.message) {
          logger.error(`\nReason as follows:\n`);
          logger.error(e.message);
        }
      }
      throw e;
    }
  }

  help(formatter: HelpFormatter = defaultHelpFormatter) {
    return formatter(this.meta, this.commands);
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
    return await match<string[], Promise<Output<Commands>>>(argv)
      .with([P.union('--help', '-h')], async () => {
        // show command help
        config.logger?.log(command.help());
        return { kind: 'help' };
      })
      .otherwise(async () => {
        const output = await command.run(argv, config);
        return {
          kind: 'command',
          command: name,
          ...output,
        } as Output<Commands>;
      });
  }
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
