import { Env } from './config/env';
import { Parser } from './config/parser';
import { Logger } from './config/logger';
import { InferOptionType, Option } from './option.types';
import { Prompter } from './config/prompter';
import { ErrorFormatter } from './config/error-formatter';
import { ArgvFormatter } from './config/argv-formatter';

type CommonMeta = {
  readonly description?: string;
  readonly shouldTriggerHelp?: (argv: string[]) => boolean;
};

export type ProgramMeta = CommonMeta & {
  argvFormatter?: ArgvFormatter;
  errorFormatter?: ErrorFormatter;
};

export type CommandMeta = CommonMeta;

export type MetaArgs = { _: string[] };

export type HandlerInput<A> = {
  args: A & MetaArgs;
  argv: string[];
  logger: Logger;
  prompter: Prompter;
};

export type RuntimeConfig = {
  readonly parser?: Parser;
  readonly logger?: Logger;
  readonly prompter?: Prompter;
  readonly env?: Env;
};

export type EmptyObject = NonNullable<unknown>;
export type GenericParsedArgs = Record<string, any>;
export type AliasedOption = { aliases: string[]; spec: Option };
export type GenericOptions = {
  readonly [K in string]: AliasedOption;
};
export type CommandOutput<Options extends GenericOptions, HandlerResult> = {
  readonly args: ParsedArgsFromOptions<Options>;
  readonly result: Awaited<HandlerResult>;
};

export type ParsedArgsFromOptions<O extends GenericOptions> = {
  readonly [K in keyof O]: InferOptionType<O[K]['spec']>;
};

export type Validation<T> =
  | { success: true; value: T }
  | { success: false; error: string };

export type SimpleValidation<T> = boolean | string | Validation<T>;
