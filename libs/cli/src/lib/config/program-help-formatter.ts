import { Command } from '../command.types';
import { Aliased, GenericOptions, ProgramMeta } from '../types';

export interface ProgramHelpFormatter {
  format(
    meta: ProgramMeta,
    commands: Record<string, Aliased<Command<any, unknown>>>
  ): string;
}
