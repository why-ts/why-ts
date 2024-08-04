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

export function strings<O extends OptionBase>(
  options?: O & {
    fallback?: () => string[] | undefined;
  }
): O & OptionStringArrayVariant {
  return {
    [TYPE]: 'string-array',
    ...options,
  } as any;
}

export function string<O extends OptionBase>(
  options?: O & {
    fallback?: () => string | undefined;
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
  }
): O & OptionNumberArrayVariant {
  return {
    [TYPE]: 'number-array',
    ...options,
  } as any;
}

export function number<O extends OptionBase>(
  options?: O & {
    fallback?: () => number | undefined;
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
  }
): O & OptionBooleanVariant {
  return {
    [TYPE]: 'boolean',
    ...options,
  } as any;
}

// TODO: support generating choices via async function (`choices: () => Promise<readonly T[]>`)
export function choices<T extends string, O extends OptionBase>(
  choices: readonly T[],
  options?: O & {
    fallback?: () => T | undefined;
  }
): O & OptionChoicesVariant<T> {
  return {
    [TYPE]: 'string-choices',
    choices,
    ...options,
  } as any;
}
