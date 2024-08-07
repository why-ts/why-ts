import { camelCase } from 'change-case';
import minimist from 'minimist';
import { P, match } from 'ts-pattern';
import { FALSY } from '../constant';
import { UsageError } from '../error';
import { TYPE, type Option, type OptionChoicesVariant } from '../option.types';
import {
  EmptyObject,
  GenericOptions,
  MetaArgs,
  ParsedArgsFromOptions,
  SimpleValidation,
  Validation,
} from '../types';
import { Env } from './env';
import { noop } from '../util';

type FullArgs<Options extends GenericOptions = EmptyObject> =
  ParsedArgsFromOptions<Options> & MetaArgs;

export interface Parser {
  parse<Options extends GenericOptions = EmptyObject>(
    options: Options,
    argv: string[],
    env: Env
  ): Promise<FullArgs<Options>>;
}

export class MinimistParser implements Parser {
  async parse<Options extends GenericOptions = EmptyObject>(
    options: Options,
    argv: string[],
    env: Env
  ): Promise<FullArgs<Options>> {
    const parsed = minimist(argv, {
      string: Object.entries(options)
        .filter(([, v]) => v[TYPE].startsWith('string')) // force minimist to parse input as string
        .map(([k]) => k),
    });

    const args = { _: parsed._ } as FullArgs<Options>;
    const errors: string[] = [];
    for (const rawKey in options) {
      const camelKey = camelCase(rawKey) as keyof Options;
      const option = options[rawKey];
      const { fallback, required } = option;

      let value = parsed[rawKey];

      // try env var if value is undefined
      if (value === undefined && option.env) {
        value = env.get(option.env);
      }

      // invoke fallback if value is still undefined
      if (value === undefined && fallback) {
        value = fallback();
      }

      // throw if required value is still undefined after fallback
      if (value === undefined && required) {
        errors.push(`--${rawKey} is required`);
      }

      // built-in validation
      if (value !== undefined) {
        match(this.validate(rawKey, value, option))
          .with({ success: false }, ({ error }) => errors.push(error))
          .with({ success: true }, ({ value }) => (args[camelKey] = value))
          .exhaustive();
      }

      // custom validation
      if (value !== undefined && option.validate) {
        match((option.validate as (value: any) => SimpleValidation<any>)(value))
          .with(true, noop)
          .with(false, () => errors.push(`--${rawKey} is invalid`))
          .with(P.string, (e) => errors.push(e))
          .with({ success: false }, ({ error }) => errors.push(error))
          .with({ success: true }, (o) => (value = o.value)) // maybe-transformed value
          .exhaustive();
      }
    }

    if (errors.length > 0) {
      throw new UsageError('RUNTIME_ERROR', errors.join('\n'));
    }

    return args;
  }

  private validate(key: string, value: any, option: Option): Validation<any> {
    const fail = (error: string): Validation<any> => ({
      success: false,
      error,
    });
    const ok = (value: any): Validation<any> => ({ success: true, value });

    const expected = option[TYPE];
    const actual = match(typeof value)
      .with('object', () => (Array.isArray(value) ? 'array' : 'object'))
      .otherwise((type) => type);

    return match([expected, actual])
      .with(['number', 'number'], () => ok(value))
      .with(['number', 'string'], () => {
        const num = Number(value);
        return isNaN(num)
          ? fail(`--${key} must be a number but got ${value}`)
          : ok(num);
      })

      .with(['number-array', 'number'], () => ok([value]))
      .with(['number-array', 'array'], () =>
        match(value.filter((v: unknown) => typeof v !== 'number' || isNaN(v)))
          .with([], () => ok(value))
          .otherwise((nonNumbers) =>
            fail(
              `--${key} must be an number but got [${nonNumbers.join(', ')}]`
            )
          )
      )

      .with(['boolean', 'string'], () =>
        ok(!FALSY.includes(value.toLowerCase()))
      )
      .with(['boolean', 'number'], () => ok(value !== 0))
      .with(['boolean', 'boolean'], () => ok(value))

      .with(['string', 'string'], () => ok(value))

      .with(['string-array', 'string'], () => ok([value]))
      .with(['string-array', 'array'], () => ok(value.map(String)))

      .with(['string-choices', 'string'], () => {
        const { choices } = option as OptionChoicesVariant;
        return choices.includes(value)
          ? ok(value)
          : fail(
              `--${key} must be one of [${choices.join(
                ', '
              )}], but got ${value}`
            );
      })
      .with(
        [P.union('number', 'boolean', 'string', 'string-choices'), 'array'],
        () =>
          fail(
            `--${key} only accepts a single value but is specified multiple times with values: ` +
              `[${value.join(', ')}]`
          )
      )
      .otherwise(([expected, actual]) =>
        fail(`--${key} must be a ${expected} but got ${value} (${actual})`)
      );
  }
}

export default new MinimistParser();
