import { Aliased, CommandMeta } from '../types';
import { Option } from '../option.types';

type Options = Record<string, Aliased<Option>>;

export interface CommandHelpFormatter {
  format(meta: CommandMeta, options: Options): string;
}
