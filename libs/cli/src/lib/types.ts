import { Env } from './config/env';
import { Logger } from './config/logger';
import { InferOptionType, Option } from './option.types';
import { Prompter } from './config/prompter';

export type ProgramMeta = {
  readonly description?: string;
};

export type CommandMeta = {
  readonly description?: string;
};

export type MetaArgs = { _: string[] };

export type HandlerInput<A> = {
  args: A & MetaArgs;
  argv: string[];
  logger: Logger;
  prompter: Prompter;
};

export type RuntimeConfig = {
  readonly logger?: Logger;
  readonly prompter?: Prompter;
  readonly env?: Env;
};

export type EmptyObject = NonNullable<unknown>;
export type GenericParsedArgs = Record<string, any>;
export type GenericOptions = { readonly [K in string]: Option };
export type CommandOutput<Options extends GenericOptions, HandlerResult> = {
  readonly args: ParsedArgsFromOptions<Options>;
  readonly result: Awaited<HandlerResult>;
};

export type ParsedArgsFromOptions<O extends GenericOptions> = {
  readonly [K in keyof O]: InferOptionType<O[K]>;
};

export type Validation<T> =
  | { success: true; value: T }
  | { success: false; error: string };

export type SimpleValidation<T> = boolean | string | Validation<T>;
