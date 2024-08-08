import {
  EmptyObject,
  GenericOptions,
  MetaArgs,
  ParsedArgsFromOptions,
} from '../types';
import { Env } from './env';

export interface Parser {
  parse<Options extends GenericOptions = EmptyObject>(
    options: Options,
    argv: string[],
    env: Env
  ): Promise<ParsedArgsFromOptions<Options> & MetaArgs>;
}
