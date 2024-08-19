import { Aliasable } from './types';

export function maxLength(arr: string[]): number {
  return arr.reduce((acc, cur) => (cur.length > acc ? cur.length : acc), 0);
}

export function getTtyWidth(): number {
  let width = 80;
  if (typeof process !== 'undefined') {
    width = process.stdout.columns ?? 80;
  }
  return width;
}

export function extractAliases<N extends string>(
  name: Aliasable<N>
): { name: N; aliases: string[] } {
  return typeof name === 'string'
    ? { name, aliases: [] }
    : Array.isArray(name)
    ? { name: name[0], aliases: name.slice(1) }
    : name;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function noop() {}
