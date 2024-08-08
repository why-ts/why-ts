import { ArgType } from '../option.types';

export interface Env {
  get(key: string): string | undefined;
  transform(value: string, type: ArgType, key: string): any;
}
