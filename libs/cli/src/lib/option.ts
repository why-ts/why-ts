import {
  OptionBase,
  OptionBooleanVariant,
  OptionChoicesVariant,
  OptionNumberArrayVariant,
  OptionNumberVariant,
  OptionStringArrayVariant,
  OptionStringVariant,
  TYPE,
} from './option.types';
import { SimpleValidation } from './types';

export function strings<O extends OptionBase>(
  options?: O & {
    fallback?: () => string[] | undefined;
    validate?: (value: string[]) => SimpleValidation<string[]>;
  }
): O & OptionStringArrayVariant {
  return {
    [TYPE]: 'strings',
    ...options,
  } as any;
}

export function string<O extends OptionBase>(
  options?: O & {
    fallback?: () => string | undefined;
    validate?: (value: string) => SimpleValidation<string>;
  }
): O & OptionStringVariant {
  return {
    [TYPE]: 'string',
    ...options,
  } as any;
}

export function numbers<O extends OptionBase>(
  options?: O & {
    fallback?: () => number[] | undefined;
    validate?: (value: number[]) => SimpleValidation<number[]>;
  }
): O & OptionNumberArrayVariant {
  return {
    [TYPE]: 'numbers',
    ...options,
  } as any;
}

export function number<O extends OptionBase>(
  options?: O & {
    fallback?: () => number | undefined;
    validate?: (value: number) => SimpleValidation<number>;
  }
): O & OptionNumberVariant {
  return {
    [TYPE]: 'number',
    ...options,
  } as any;
}

export function boolean<O extends OptionBase>(
  options?: O & {
    fallback?: () => boolean | undefined;
    validate?: (value: boolean) => SimpleValidation<boolean>;
  }
): O & OptionBooleanVariant {
  return {
    [TYPE]: 'boolean',
    ...options,
  } as any;
}

// TODO: support generating choice via async function (`choice: () => Promise<readonly T[]>`)
export function choice<T extends string, O extends OptionBase>(
  choices: readonly T[],
  options?: O & {
    fallback?: () => T | undefined;
    validate?: (value: T) => SimpleValidation<T>;
  }
): O & OptionChoicesVariant<T> {
  return {
    [TYPE]: 'choice',
    choices,
    ...options,
  } as any;
}
