import { FALSY } from '../constant';
import { ArgType } from '../option.types';

export interface Env {
  get(key: string): string | undefined;
  transform(value: string, type: ArgType, key: string): any;
}

export class DefaultEnv implements Env {
  readonly hasProcessEnv = typeof process !== 'undefined' && process.env;

  get(key: string): string | undefined {
    return this.hasProcessEnv ? process.env[key] : undefined;
  }

  transform(value: string, type: ArgType): any {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'number-array':
        return value.split(',').map(parseFloat);
      case 'boolean':
        return !FALSY.includes(value.toLowerCase() as any);
      case 'string-array':
        return value.split(',');
      default:
        return value;
    }
  }
}

export default new DefaultEnv();
