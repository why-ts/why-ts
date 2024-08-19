import { camelCase } from 'change-case';
import minimist from 'minimist';
import { P, match } from 'ts-pattern';
import { FALSY } from '../constant';
import { ArgProblem, InvalidArgsError } from '../error';
import { TYPE, type Option, type OptionChoicesVariant } from '../option.types';
import {
  EmptyObject,
  GenericOptions,
  MetaArgs,
  ParsedArgsFromOptions,
  SimpleValidation,
  Validation,
} from '../types';
import { noop } from '../util';
import { Env } from './env';
import { Parser } from './parser';

type ParserReturn<Options extends GenericOptions = EmptyObject> =
  ParsedArgsFromOptions<Options> & MetaArgs;

export class MinimistParser implements Parser {
  async parse<Options extends GenericOptions = EmptyObject>(
    options: Options,
    argv: string[],
    env: Env
  ): Promise<ParserReturn<Options>> {
    const parsed = minimist(argv, {
      '--': true,
      string: Object.entries(options)
        .filter(([, v]) => v.value[TYPE].startsWith('string')) // force minimist to parse input as string
        .map(([k]) => k),
      alias: Object.fromEntries(
        Object.entries(options).reduce(
          (acc, [k, { aliases }]) => [
            ...acc,
            ...aliases.map<[string, string]>((a) => [a, k]),
          ],
          [] as [string, string][]
        )
      ),
    });

    const args = {
      _: parsed._,
      '--': parsed['--'] ?? [],
    } as ParserReturn<Options>;
    const errors: ArgProblem[] = [];
    for (const rawKey in options) {
      const camelKey = camelCase(rawKey) as keyof Options;
      const option = options[rawKey].value;
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
        errors.push({ option: rawKey, kind: 'required' });
        continue;
      }

      // built-in validation
      if (value !== undefined) {
        match(this.validate(value, option))
          .with({ success: false }, ({ error }) =>
            errors.push({ option: rawKey, kind: 'validation', message: error })
          )
          .with(
            { success: true },
            ({ value }) =>
              (args[camelKey] = value as ParserReturn<Options>[keyof Options])
          )
          .exhaustive();
      }

      // custom validation
      if (value !== undefined && option.validate) {
        match(
          (option.validate as (value: unknown) => SimpleValidation<unknown>)(
            value
          )
        )
          .with(true, noop)
          .with(false, () =>
            errors.push({
              option: rawKey,
              kind: 'custom-validation',
            })
          )
          .with(P.string, (e) =>
            errors.push({
              option: rawKey,
              kind: 'custom-validation',
              message: e,
            })
          )
          .with({ success: false }, ({ error }) =>
            errors.push({
              option: rawKey,
              kind: 'custom-validation',
              message: error,
            })
          )
          .with({ success: true }, (o) => (value = o.value)) // maybe-transformed value
          .exhaustive();
      }
    }

    if (errors.length > 0) {
      throw new InvalidArgsError(errors);
    }

    return args;
  }

  private validate(value: unknown, option: Option): Validation<unknown> {
    const fail = (error: string): Validation<unknown> => ({
      success: false,
      error,
    });
    const ok = (value: unknown): Validation<unknown> => ({
      success: true,
      value,
    });

    const expected = option[TYPE];

    return match([expected, value])
      .with(['number', P.number], ([, v]) => ok(v))
      .with(['number', P.string], ([, v]) => {
        const num = Number(v);
        return isNaN(num)
          ? fail(`must be a number but got ${this.printValue(value)}`)
          : ok(num);
      })

      .with(['numbers', P.number], ([, v]) => ok([v]))
      .with(['numbers', P.array(P.number)], ([, v]) =>
        match(v.filter(isNaN))
          .with([], () => ok(value))
          .otherwise((invalid) =>
            fail(`must be an number but got ${this.printValue(invalid)}`)
          )
      )

      .with(['date', P.string.or(P.number)], ([, v]) => {
        const date = new Date(v);
        return isNaN(date.getTime())
          ? fail(`must be a date but got ${this.printValue(value)}`)
          : ok(date);
      })

      .with(['dates', P.string.or(P.number)], ([, v]) => {
        const date = new Date(v);
        return isNaN(date.getTime())
          ? fail(`must be an date but got ${this.printValue(value)}`)
          : ok([date]);
      })
      .with(['dates', P.array(P.string.or(P.number))], ([, v]) => {
        const dates = v.map((x) => [x, new Date(x)] as const);
        return match(dates.filter(([, x]) => isNaN(x.getTime())))
          .with([], () => ok(dates.map(([, x]) => x)))
          .otherwise((invalid) =>
            fail(
              `must be an array of dates but got ${this.printValue(
                invalid.map(([x]) => x)
              )}`
            )
          );
      })

      .with(['boolean', P.string], ([, v]) =>
        ok(!FALSY.includes(v.toLowerCase()))
      )
      .with(['boolean', P.number], ([, v]) => ok(v !== 0))
      .with(['boolean', P.boolean], ([, v]) => ok(v))

      .with(['string', P.string], ([, v]) => ok(v))

      .with(['strings', P.string], ([, v]) => ok([v]))
      .with(['strings', P.array()], ([, v]) => ok(v.map(String)))

      .with(['choice', P.string], ([, v]) => {
        const { choices } = option as OptionChoicesVariant;
        return choices.includes(v)
          ? ok(v)
          : fail(
              `must be one of [${choices.join(', ')}] ` +
                `but got ${this.printValue(v)}`
            );
      })
      .with(
        [P.union('number', 'boolean', 'string', 'choice'), P.array()],
        ([, v]) =>
          fail(
            `only accepts a single value but is specified multiple times with values: ` +
              this.printValue(v)
          )
      )
      .otherwise(([e, v]) => {
        const expected = match(e)
          .with(
            P.union('numbers', 'dates', 'strings'),
            () => `an array of ${e}`
          )
          .otherwise((e) => `a ${e}`);

        return fail(`must be ${expected} but got ${this.printValue(v)}`);
      });
  }

  private printValue(v: unknown): string {
    const typeOf = (v: unknown) =>
      match(v)
        .with(P.array(), () => 'array')
        .with(P.instanceOf(Date), () => 'date')
        .otherwise(() => typeof v);

    const printSingle = (v: unknown) => `${v} (${typeOf(v)})`;

    return Array.isArray(v)
      ? `[${v.map(printSingle).join(', ')}]`
      : printSingle(v);
  }
}

export default new MinimistParser();
