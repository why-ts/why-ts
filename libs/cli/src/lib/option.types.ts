import { SimpleValidation } from './types';

export const TYPE = 'type' as const;
export const OPTION_VALUE_TYPES = [
  'string',
  'strings',
  'number',
  'numbers',
  'boolean',
  'choice',
] as const;
export type OptionValueType = (typeof OPTION_VALUE_TYPES)[number];

export type Option = OptionBase & OptionVariant;

export type InferRequiredOptionValueType<
  O extends Option,
  R extends boolean | undefined,
> = R extends true
  ? InferOptionValueType<O>
  : InferOptionValueType<O> | undefined;

export type InferOptionValueType<O extends Option> = O extends {
  [TYPE]: 'number';
}
  ? number
  : O extends { [TYPE]: 'numbers' }
    ? number[]
    : O extends { [TYPE]: 'date' }
      ? Date
      : O extends { [TYPE]: 'dates' }
        ? Date[]
        : O extends { [TYPE]: 'boolean' }
          ? boolean
          : O extends { [TYPE]: 'dict' }
            ? Dict
            : O extends { [TYPE]: 'strings' }
              ? string[]
              : O extends { [TYPE]: 'choice'; choices: infer C }
                ? C extends readonly string[]
                  ? C[number]
                  : never
                : string;

export type InferOptionType<O extends Option> = InferRequiredOptionValueType<
  O,
  O['required']
>;

export type Dict = Map<string, string>;

export type OptionBase = {
  // readonly [TYPE]: OptionValueType;
  readonly required?: boolean; // TODO: `| 'prompt'` for interactive prompts
  readonly description?: string;
  readonly env?: string;
};
export type OptionVariant =
  | OptionChoicesVariant
  | OptionDictVariant
  | OptionStringArrayVariant
  | OptionStringVariant
  | OptionNumberArrayVariant
  | OptionNumberVariant
  | OptionDateVariant
  | OptionDateArrayVariant
  | OptionBooleanVariant;

export type OptionStringVariant = {
  readonly [TYPE]: 'string';
  readonly fallback?: () => string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // `any` is required for func arg variance to work properly
  readonly validate?: (value: any) => SimpleValidation<string>;
};

export type OptionStringArrayVariant = {
  readonly [TYPE]: 'strings';
  readonly fallback?: () => string[] | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // `any` is required for func arg variance to work properly
  readonly validate?: (value: any) => SimpleValidation<string[]>;
};

export type OptionNumberVariant = {
  readonly [TYPE]: 'number';
  readonly fallback?: () => number | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // `any` is required for func arg variance to work properly
  readonly validate?: (value: any) => SimpleValidation<number>;
};

export type OptionNumberArrayVariant = {
  readonly [TYPE]: 'numbers';
  readonly fallback?: () => number[] | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // `any` is required for func arg variance to work properly
  readonly validate?: (value: any) => SimpleValidation<number[]>;
};

export type OptionDateVariant = {
  readonly [TYPE]: 'date';
  readonly fallback?: () => Date | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // `any` is required for func arg variance to work properly
  readonly validate?: (value: any) => SimpleValidation<Date>;
};

export type OptionDateArrayVariant = {
  readonly [TYPE]: 'dates';
  readonly fallback?: () => Date[] | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // `any` is required for func arg variance to work properly
  readonly validate?: (value: any) => SimpleValidation<Date[]>;
};

export type OptionBooleanVariant = {
  readonly [TYPE]: 'boolean';
  readonly fallback?: () => boolean | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // `any` is required for func arg variance to work properly
  readonly validate?: (value: any) => SimpleValidation<boolean>;
};

export type OptionDictVariant = {
  readonly [TYPE]: 'dict';
  readonly separator?: string;
  readonly fallback?: () => Dict | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // `any` is required for func arg variance to work properly
  readonly validate?: (value: any) => SimpleValidation<Dict>;
};

export type OptionChoicesVariant<T extends string = string> = {
  readonly [TYPE]: 'choice';
  readonly choices: readonly T[];
  readonly fallback?: () => T | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // `any` is required for func arg variance to work properly
  readonly validate?: (value: any) => SimpleValidation<T>;
};
