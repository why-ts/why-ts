import { Command } from './command.types';
import { type ProgramHelpFormatter } from './config/program-help-formatter';
import { Aliasable, EmptyObject, ProgramMeta, RuntimeConfig } from './types';
import { CommandOutput, GenericCommands } from './command.types';

export interface Program<Commands extends GenericCommands = EmptyObject> {
  readonly commands: Commands;
  readonly metadata: ProgramMeta & RuntimeConfig;

  command<Name extends string, Cmd extends Command<any, any>>(
    name: Aliasable<Name>,
    command: Cmd
  ): Program<
    Commands & {
      [N in Name]: { aliases: string[]; command: Cmd };
    }
  >;

  run(argv: string[], config?: RuntimeConfig): Promise<ProgramOutput<Commands>>;

  help(formatter?: ProgramHelpFormatter): string;
}

export type ProgramOutput<Commands extends GenericCommands> =
  | ({ kind: 'command' } & UnionFromRecord<{
      [CommandName in keyof Commands]: InferCommandOutput<
        Commands[CommandName]['command']
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
