import { match } from 'ts-pattern';
import { TYPE, type Option, type OptionChoicesVariant } from './option.types';
import { CommandMeta as Meta } from './types';

// unfortunately, table-layout does not have types
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Table from 'table-layout';

export type HelpFormatter = (
  meta: Meta,
  options: Record<string, Option>
) => string;

function table<T>(arr: T[]) {
  return new Table(arr, { maxWidth: process.stdout.columns }).toString();
}

const defaultHelpFormatter: HelpFormatter = (
  meta: Meta,
  options: Record<string, Option>
): string => {
  function printOptionType(option: Option) {
    return match(option[TYPE])
      .with(
        'string-choices',
        () =>
          `[choices: ${(option as OptionChoicesVariant).choices.join(', ')}]`
      )
      .otherwise((type) => `[${type}]`);
  }
  function printOptions(options: [string, Option][]) {
    return table(
      options.map(([key, option]) => ({
        key: `--${key}`,
        description: option.description,
        type: printOptionType(option),
      }))
    );
  }

  const parts = [meta?.description, meta?.description && '', ''];

  function addOptionsSection(required: boolean) {
    match(
      Object.entries(options).filter(
        ([, o]) => Boolean(o.required) === required
      )
    )
      .when(
        (v) => v.length,
        (o) =>
          parts.push(
            `${required ? 'Required' : 'Optional'} Flags:`,
            '',
            printOptions(o),
            ''
          )
      )
      .otherwise(() => undefined);
  }
  addOptionsSection(true);
  addOptionsSection(false);
  return parts.filter((v) => v !== undefined).join('\n');
};

export default defaultHelpFormatter;
