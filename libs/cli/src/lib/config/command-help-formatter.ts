import { type Option } from '../option.types';
import { AliasedOption, CommandMeta } from '../types';

type Options = Record<string, AliasedOption>;

export interface CommandHelpFormatter {
  format(meta: CommandMeta, options: Options): string;
}
