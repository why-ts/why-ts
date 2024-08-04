import { P, match } from 'ts-pattern';
import defaultLogger from './logger';
import { type Logger } from './logger';
import { Command } from './command';
import { UsageError } from './error';
import defaultHelpFormatter, { type HelpFormatter } from './program.formatter';
import defaultPrompter, { Prompter } from './prompter';
import {
  CommandOutput,
  EmptyObject,
  ProgramMeta as Meta,
  RunOptions,
} from './types';

export function program(meta: Meta & RunOptions = {}) {
  return new Program({}, meta);
}

class Program<Commands extends GenericCommands = EmptyObject> {
  constructor(
    public commands: Commands,
    public readonly meta: Meta & RunOptions
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

  async run(argv: string[], options?: RunOptions): Promise<Output<Commands>> {
    const { logger = defaultLogger, prompter = defaultPrompter } = {
      ...this.meta,
      ...options,
    };

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
          return { help: true };
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
            logger,
            prompter,
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
    logger,
    prompter,
  }: {
    name: string;
    argv: string[];
    command: Command<any, any>;
    logger: Logger;
    prompter: Prompter;
  }): Promise<Output<Commands>> {
    return await match<string[], Promise<Output<Commands>>>(argv)
      .with([P.union('--help', '-h')], async () => {
        // show command help
        logger.log(command.help());
        return { help: true };
      })
      .otherwise(async () => {
        const output = await command.run(argv, { logger, prompter });
        return { command: name, ...output } as Output<Commands>;
      });
  }
}

type GenericCommands = { readonly [K: string]: Command<any, any> };

type Output<Commands extends GenericCommands> =
  | UnionFromRecord<{
      [CommandName in keyof Commands]: InferCommandOutput<
        Commands[CommandName]
      >;
    }>
  | { help: true };

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
