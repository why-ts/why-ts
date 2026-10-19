import { CamelCase } from 'type-fest';
import { type CommandHelpFormatter } from './config/command-help-formatter';
import { type Option } from './option.types';
import {
  Aliasable,
  Aliased,
  EmptyObject,
  GenericOptions,
  HandlerInput,
  CommandMeta as Meta,
  ParsedArgsFromOptions,
  RuntimeConfig,
} from './types';

export interface Command<
  Options extends GenericOptions = EmptyObject,
  HandlerResult = void,
> {
  readonly options: Options;
  readonly metadata: Metadata;

  meta(
    metadata: Metadata | ((current: Metadata) => Metadata),
  ): Command<Options, HandlerResult>;

  option<N extends string, O extends Option>(
    name: Aliasable<N>,
    option: O,
  ): Command<Options & CamelCasedKey<N, Aliased<O>>, HandlerResult>;

  handle<R>(
    handler: HandlerReplacement<Options, HandlerResult, R>,
  ): Command<Options, R>;

  run(
    argv: string[],
    config?: RuntimeConfig,
  ): Promise<CommandOutput<Options, HandlerResult>>;

  help(formatter?: CommandHelpFormatter): string;
}

export type Metadata = Meta & RuntimeConfig;
export type Handler<O extends GenericOptions, R> = (
  input: HandlerInput<ParsedArgsFromOptions<O>>,
) => R;
export type HandlerReplacement<O extends GenericOptions, R1, R2> = (
  input: HandlerInput<ParsedArgsFromOptions<O>>,
  current: Handler<O, R1>,
) => R2;

export type GenericCommands = {
  readonly [K: string]: Aliased<Command<any, unknown>>;
};

/**
 * `{ [camelCase(N)]: V }`, using type-fest's `CamelCase`. Extend options with
 * `Options & CamelCasedKey<N, Aliased<O>>`.
 *
 * Any relation or inference between two different `CamelCase<...>`
 * instantiations (e.g. checking `CommandImpl` against `Command`) makes
 * TypeScript measure `CamelCase`'s variance, and that measurement overflows
 * the stack (RangeError in `outofbandVarianceMarkerHandler`). Two guards keep
 * the checker away from `CamelCase`:
 * - `in out` supplies this alias's variance, so relations stop here.
 * - `NoInfer` stops inference from descending into the key type.
 * Do not wrap the intersection in another generic alias: measuring that
 * alias's variance reaches `CamelCase` again.
 * See docs/notes/2609151_cli_stack_overflow_debug_log.md.
 */
export type CamelCasedKey<in out N extends string, V> = {
  [_ in NoInfer<CamelCase<N>>]: V;
};

export type CommandOutput<Options extends GenericOptions, HandlerResult> = {
  readonly args: ParsedArgsFromOptions<Options>;
  readonly result: Awaited<HandlerResult>;
};
