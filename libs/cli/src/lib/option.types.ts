import { SimpleValidation } from './types';

export const TYPE = 'type' as const;
export type ArgType = OptionVariant[typeof TYPE];

export type Option = OptionBase & OptionVariant;

export type InferRequiredArgType<
  O extends Option,
  R extends boolean | undefined
> = R extends true ? InferArgType<O> : InferArgType<O> | undefined;

export type InferArgType<O extends Option> = O extends { [TYPE]: 'number' }
  ? number
  : O extends { [TYPE]: 'boolean' }
  ? boolean
  : O extends { [TYPE]: 'strings' }
  ? string[]
  : O extends { [TYPE]: 'numbers' }
  ? number[]
  : O extends { [TYPE]: 'choice'; choices: infer C }
  ? C extends readonly string[]
    ? C[number]
    : never
  : string;

export type InferOptionType<O extends Option> = InferRequiredArgType<
  O,
  O['required']
>;

export type OptionBase = {
  readonly required?: boolean; // TODO: `| 'prompt'` for interactive prompts
  readonly description?: string;
  readonly env?: string;
};
export type OptionVariant =
  | OptionChoicesVariant
  | OptionStringArrayVariant
  | OptionStringVariant
  | OptionNumberArrayVariant
  | OptionNumberVariant
  | OptionBooleanVariant;

export type OptionStringVariant = {
  readonly [TYPE]: 'string';
  readonly fallback?: () => string | undefined;
  readonly validate?: (value: any) => SimpleValidation<string>;
};

export type OptionStringArrayVariant = {
  readonly [TYPE]: 'strings';
  readonly fallback?: () => string[] | undefined;
  readonly validate?: (value: any) => SimpleValidation<string[]>;
};

export type OptionNumberVariant = {
  readonly [TYPE]: 'number';
  readonly fallback?: () => number | undefined;
  readonly validate?: (value: any) => SimpleValidation<number>;
};

export type OptionNumberArrayVariant = {
  readonly [TYPE]: 'numbers';
  readonly fallback?: () => number[] | undefined;
  readonly validate?: (value: any) => SimpleValidation<number[]>;
};

export type OptionBooleanVariant = {
  readonly [TYPE]: 'boolean';
  readonly fallback?: () => boolean | undefined;
  readonly validate?: (value: any) => SimpleValidation<boolean>;
};

export type OptionChoicesVariant<T extends string = string> = {
  readonly [TYPE]: 'choice';
  readonly choices: readonly T[];
  readonly fallback?: () => T | undefined;
  readonly validate?: (value: any) => SimpleValidation<T>;
};
