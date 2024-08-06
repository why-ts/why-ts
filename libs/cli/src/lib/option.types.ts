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
  : O extends { [TYPE]: 'string-array' }
  ? string[]
  : O extends { [TYPE]: 'number-array' }
  ? number[]
  : O extends { [TYPE]: 'string-choices'; choices: infer C }
  ? C extends readonly string[]
    ? C[number]
    : never
  : string;

export type InferOptionType<O extends Option> = InferRequiredArgType<
  O,
  O['required']
>;

export type OptionBase = {
  // readonly aliases?: readonly string[]; // TODO: Implement aliases
  readonly required?: boolean;
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
  readonly [TYPE]: 'string-array';
  readonly fallback?: () => string[] | undefined;
  readonly validate?: (value: any) => SimpleValidation<string[]>;
};

export type OptionNumberVariant = {
  readonly [TYPE]: 'number';
  readonly fallback?: () => number | undefined;
  readonly validate?: (value: any) => SimpleValidation<number>;
};

export type OptionNumberArrayVariant = {
  readonly [TYPE]: 'number-array';
  readonly fallback?: () => number[] | undefined;
  readonly validate?: (value: any) => SimpleValidation<number[]>;
};

export type OptionBooleanVariant = {
  readonly [TYPE]: 'boolean';
  readonly fallback?: () => boolean | undefined;
  readonly validate?: (value: any) => SimpleValidation<boolean>;
};

export type OptionChoicesVariant<T extends string = string> = {
  readonly [TYPE]: 'string-choices';
  readonly choices: readonly T[];
  readonly fallback?: () => T | undefined;
  readonly validate?: (value: any) => SimpleValidation<T>;
};
