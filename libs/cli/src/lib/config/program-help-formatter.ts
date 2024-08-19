import { Command } from '../command';
import { ProgramMeta } from '../types';

export interface ProgramHelpFormatter {
  format(
    meta: ProgramMeta,
    commands: Record<string, { aliases: string[]; command: Command<any, any> }>
  ): string;
}
