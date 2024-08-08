import { OptionValueType } from '../option.types';

export interface Env {
  get(key: string): string | undefined;
  transform(value: string, type: OptionValueType, key: string): any;
}
