import { CamelCase } from 'type-fest';
import { type CommandHelpFormatter } from './config/command-help-formatter';
import { type Option } from './option.types';
import {
  Aliasable,
  EmptyObject,
  GenericOptions,
  HandlerInput,
  CommandMeta as Meta,
  ParsedArgsFromOptions,
  RuntimeConfig,
} from './types';

export interface Command<
  Options extends GenericOptions = EmptyObject,
  HandlerResult = void
> {
  readonly options: Options;
  readonly metadata: Metadata;

  meta(
    metadata: Metadata | ((current: Metadata) => Metadata)
  ): Command<Options, HandlerResult>;

  option<N extends string, O extends Option>(
    name: Aliasable<N>,
    option: O
  ): Command<
    Options & { [K in CamelCase<N>]: { aliases: string[]; option: O } },
    HandlerResult
  >;

  handle<R>(
    handler: HandlerReplacement<Options, HandlerResult, R>
  ): Command<Options, R>;

  run(
    argv: string[],
    config?: RuntimeConfig
  ): Promise<CommandOutput<Options, HandlerResult>>;

  help(formatter?: CommandHelpFormatter): string;
}

export type Metadata = Meta & RuntimeConfig;
export type Handler<O extends GenericOptions, R> = (
  input: HandlerInput<ParsedArgsFromOptions<O>>
) => R;
export type HandlerReplacement<O extends GenericOptions, R1, R2> = (
  input: HandlerInput<ParsedArgsFromOptions<O>>,
  current: Handler<O, R1>
) => R2;

export type AliasedCommand<O extends GenericOptions, H> = {
  readonly aliases: string[];
  readonly command: Command<O, H>;
};

export type GenericCommands = {
  readonly [K: string]: AliasedCommand<any, any>;
};

export type CommandOutput<Options extends GenericOptions, HandlerResult> = {
  readonly args: ParsedArgsFromOptions<Options>;
  readonly result: Awaited<HandlerResult>;
};
