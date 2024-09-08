import {
  Dict,
  OptionBase,
  OptionBooleanVariant,
  OptionChoicesVariant,
  OptionDateArrayVariant,
  OptionDateVariant,
  OptionDictVariant,
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
  },
): O & OptionStringArrayVariant {
  return {
    [TYPE]: 'strings',
    ...options,
  } as O & OptionStringArrayVariant;
}

export function string<O extends OptionBase>(
  options?: O & {
    fallback?: () => string | undefined;
    validate?: (value: string) => SimpleValidation<string>;
  },
): O & OptionStringVariant {
  return {
    [TYPE]: 'string',
    ...options,
  } as O & OptionStringVariant;
}

export function numbers<O extends OptionBase>(
  options?: O & {
    fallback?: () => number[] | undefined;
    validate?: (value: number[]) => SimpleValidation<number[]>;
  },
): O & OptionNumberArrayVariant {
  return {
    [TYPE]: 'numbers',
    ...options,
  } as O & OptionNumberArrayVariant;
}

export function number<O extends OptionBase>(
  options?: O & {
    fallback?: () => number | undefined;
    validate?: (value: number) => SimpleValidation<number>;
  },
): O & OptionNumberVariant {
  return {
    [TYPE]: 'number',
    ...options,
  } as O & OptionNumberVariant;
}

export function dates<O extends OptionBase>(
  options?: O & {
    fallback?: () => Date[] | undefined;
    validate?: (value: Date[]) => SimpleValidation<Date[]>;
  },
): O & OptionDateArrayVariant {
  return {
    [TYPE]: 'dates',
    ...options,
  } as O & OptionDateArrayVariant;
}

export function date<O extends OptionBase>(
  options?: O & {
    fallback?: () => Date | undefined;
    validate?: (value: Date) => SimpleValidation<Date>;
  },
): O & OptionDateVariant {
  return {
    [TYPE]: 'date',
    ...options,
  } as O & OptionDateVariant;
}

export function boolean<O extends OptionBase>(
  options?: O & {
    fallback?: () => boolean | undefined;
    validate?: (value: boolean) => SimpleValidation<boolean>;
  },
): O & OptionBooleanVariant {
  return {
    [TYPE]: 'boolean',
    ...options,
  } as O & OptionBooleanVariant;
}

export function dict<O extends OptionBase>(
  options?: O & {
    separator?: string;
    fallback?: NoInfer<() => Dict | undefined>;
    validate?: NoInfer<(value: Dict) => SimpleValidation<Dict>>;
  },
): O & OptionDictVariant {
  return {
    [TYPE]: 'dict',
    ...options,
  } as O & OptionDictVariant;
}

// TODO: support generating choice via async function (`choice: () => Promise<readonly T[]>`)
export function choice<T extends string, O extends OptionBase>(
  choices: readonly T[],
  options?: O & {
    fallback?: NoInfer<() => T | undefined>;
    validate?: NoInfer<(value: T) => SimpleValidation<T>>;
  },
): O & OptionChoicesVariant<T> {
  return {
    [TYPE]: 'choice',
    choices,
    ...options,
  } as O & OptionChoicesVariant<T>;
}
