import { getBorderCharacters, table } from 'table';
import { match } from 'ts-pattern';
import type { Option, OptionChoicesVariant } from '../option.types';
import { TYPE } from '../option.types';
import { Aliased, CommandMeta } from '../types';
import { clamp, getTtyWidth, maxLength } from '../util';
import { CommandHelpFormatter } from './command-help-formatter';

type Options = Record<string, Aliased<Option>>;

export class DefaultCommandHelpFormatter implements CommandHelpFormatter {
  format(meta: CommandMeta, options: Options): string {
    const width = getTtyWidth();

    const parts = [
      meta?.description &&
        table([[meta.description]], {
          border: getBorderCharacters('void'),
          columns: [{ paddingLeft: 0, width: width - 4, wrapWord: true }],
        }),
    ];

    const addOptionsSection = (required: boolean) => {
      match(
        Object.entries(options).filter(
          ([, { value }]) => Boolean(value.required) === required,
        ),
      )
        .when(
          (v) => v.length,
          (o) =>
            parts.push(
              `${required ? 'Required' : 'Optional'} Flags:`,
              '',
              this.printOptions(o, width),
            ),
        )
        .otherwise(() => undefined);
    };

    addOptionsSection(true);
    addOptionsSection(false);
    return parts.filter((v) => v !== undefined).join('\n');
  }

  private printOptionType(option: Option) {
    return match(option[TYPE])
      .with(
        'choice',
        () =>
          `[choices: ${(option as OptionChoicesVariant).choices.map((v) => `"${v}"`).join(', ')}]`,
      )
      .otherwise((type) => `[${type}]`);
  }

  private printOptionDefaultValue(option: Option) {
    return option.fallback ? `(default: ${option.fallback()})` : '';
  }

  private printOptions(options: [string, Aliased<Option>][], width: number) {
    const data = options.map(([key, o]) => ({
      aliases: o.aliases
        .map((v) => `-${v}, `)
        .join('')
        .trim(),
      flag: `--${key}`,
      defaultValue: this.printOptionDefaultValue(o.value),
      description: o.value.description ?? '',
      type: this.printOptionType(o.value),
    }));

    const widths = {
      aliases: maxLength(data.map((v) => v.aliases)) || 1,
      flag: maxLength(data.map((v) => v.flag)),
      defaultValue: maxLength(data.map((v) => v.defaultValue)) || 1,
      type: clamp(maxLength(data.map((v) => v.type)), 10, width - 60),
    };

    return width < 120
      ? table(
          data.flatMap((v) => [
            [v.aliases, v.flag, v.defaultValue, v.type],
            ['', v.description + '\n', '', ''],
          ]),
          {
            drawHorizontalLine: () => false,
            border: getBorderCharacters('void'),
            columns: [
              {
                width: widths.aliases,
                paddingLeft: widths.aliases === 1 ? 0 : 2,
                paddingRight: 0,
                alignment: 'right',
              }, // alias
              { width: widths.flag }, // flag
              { width: widths.defaultValue, paddingLeft: 0, paddingRight: 0 }, // default
              {
                width:
                  width -
                  widths.aliases -
                  widths.flag -
                  widths.defaultValue -
                  8,
                wrapWord: true,
                alignment: 'right',
              }, // type
            ],
            spanningCells: data.map((_, i) => ({
              col: 1,
              row: i * 2 + 1,
              colSpan: 3,
              wrapWord: true,
            })),
          },
        )
      : table(
          data.map((v) => [
            v.aliases,
            v.flag,
            v.defaultValue,
            v.description,
            v.type,
          ]),
          {
            drawHorizontalLine: () => false,
            border: getBorderCharacters('void'),
            columns: [
              {
                width: widths.aliases,
                paddingLeft: widths.aliases === 1 ? 0 : 2,
                paddingRight: 0,
                alignment: 'right',
              }, // alias
              { width: widths.flag }, // flag
              { width: widths.defaultValue, paddingLeft: 0, paddingRight: 0 }, // default
              {
                width:
                  width -
                  Object.values(widths).reduce((s, v) => s + v + 2, 0) -
                  6,
                paddingLeft: 4,
                wrapWord: true,
              }, // description
              { width: widths.type, wrapWord: true, alignment: 'right' }, // type
            ],
          },
        );
  }
}

export default new DefaultCommandHelpFormatter();
