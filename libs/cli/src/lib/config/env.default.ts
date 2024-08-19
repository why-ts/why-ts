import { FALSY } from '../constant';
import { OptionValueType } from '../option.types';
import { Env } from './env';

export class DefaultEnv implements Env {
  readonly hasProcessEnv = typeof process !== 'undefined' && process.env;

  get(key: string): string | undefined {
    return this.hasProcessEnv ? process.env[key] : undefined;
  }

  transform(value: string, type: OptionValueType): unknown {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'numbers':
        return value.split(',').map(parseFloat);
      case 'boolean':
        return !FALSY.includes(value.toLowerCase());
      case 'strings':
        return value.split(',');
      default:
        return value;
    }
  }
}

export default new DefaultEnv();
