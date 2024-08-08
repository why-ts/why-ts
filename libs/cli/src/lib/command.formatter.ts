import { match } from 'ts-pattern';
import { TYPE, type Option, type OptionChoicesVariant } from './option.types';
import { CommandMeta as Meta } from './types';
import { getBorderCharacters, table } from 'table';
import { getTtyWidth, maxLength } from './util';

type Options = Record<string, { aliases: string[]; spec: Option }>;

export type HelpFormatter = (meta: Meta, options: Options) => string;

const defaultHelpFormatter: HelpFormatter = (
  meta: Meta,
  options: Options
): string => {
  const width = getTtyWidth();

  function printOptionType(option: Option) {
    return match(option[TYPE])
      .with(
        'choice',
        () =>
          `[choices: ${(option as OptionChoicesVariant).choices.join(', ')}]`
      )
      .otherwise((type) => `[${type}]`);
  }
  function printOptions(options: [string, { spec: Option }][]) {
    const data = options.map(([key, { spec }]) => [
      `--${key}`,
      printOptionType(spec),
      spec.description ?? '',
    ]);

    return table(data, {
      border: getBorderCharacters('void'),
      columns: (() => {
        const width1 = maxLength(data.map(([v]) => v));
        const width2 = Math.min(24, maxLength(data.map(([, v]) => v)));
        return [
          { paddingLeft: 2, width: width1 },
          { paddingLeft: 4, width: width2, wrapWord: true },
          {
            paddingLeft: 4,
            width: width - width1 - width2 - 16,
            wrapWord: true,
          },
        ];
      })(),
      drawHorizontalLine: () => false,
    });
  }

  const parts = [
    meta?.description &&
      table([[meta.description]], {
        border: getBorderCharacters('void'),
        columns: [{ paddingLeft: 0, width: width - 4, wrapWord: true }],
      }),
  ];

  function addOptionsSection(required: boolean) {
    match(
      Object.entries(options).filter(
        ([, { spec }]) => Boolean(spec.required) === required
      )
    )
      .when(
        (v) => v.length,
        (o) =>
          parts.push(
            `${required ? 'Required' : 'Optional'} Flags:`,
            '',
            printOptions(o)
          )
      )
      .otherwise(() => undefined);
  }
  addOptionsSection(true);
  addOptionsSection(false);
  return parts.filter((v) => v !== undefined).join('\n');
};

export default defaultHelpFormatter;
