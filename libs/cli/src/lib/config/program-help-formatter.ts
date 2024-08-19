import { AliasedCommand } from '../command.types';
import { ProgramMeta } from '../types';

export interface ProgramHelpFormatter {
  format(
    meta: ProgramMeta,
    commands: Record<string, AliasedCommand<any, any>>
  ): string;
}
