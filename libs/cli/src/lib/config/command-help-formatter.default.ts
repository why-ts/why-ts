import { getBorderCharacters, table } from 'table';
import { match } from 'ts-pattern';
import { TYPE } from '../option.types';
import type { Option, OptionChoicesVariant } from '../option.types';
import { Aliased, CommandMeta } from '../types';
import { getTtyWidth, maxLength } from '../util';
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
    const data = options.map(([key, { aliases, value: option }]) => [
      aliases.map((v) => `-${v}`).join(', ') + (aliases.length > 0 ? ',' : ''),
      `--${key}`,
      this.printOptionDefaultValue(option),
      option.description ?? '',
      this.printOptionType(option),
    ]);

    return table(data, {
      border: getBorderCharacters('void'),
      columns: (() => {
        const widths = [
          maxLength(data.map(([v]) => v)), // alias
          maxLength(data.map(([, v]) => v)), // flag
          maxLength(data.map(([, , v]) => v)), // default
          Math.min(width - 60, maxLength(data.map(([, , , , v]) => v))), // type
        ];
        return [
          { paddingLeft: 2, paddingRight: 0, width: widths[0] }, // alias
          { width: widths[1] }, // flag
          { paddingLeft: 0, paddingRight: 0, width: widths[2] }, // default
          {
            paddingLeft: 4,
            width: width - widths.reduce((s, v) => s + v + 2, 0) - 6,
            wrapWord: true,
          }, // description
          { width: widths[3], wrapWord: true, alignment: 'right' }, // type
        ];
      })(),
      drawHorizontalLine: () => false,
    });
  }
}
export default new DefaultCommandHelpFormatter();
