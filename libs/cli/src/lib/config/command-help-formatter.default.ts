import { getBorderCharacters, table } from 'table';
import { match } from 'ts-pattern';
import { TYPE } from '../option.types';
import type { Option, OptionChoicesVariant } from '../option.types';
import { AliasedOption, CommandMeta } from '../types';
import { getTtyWidth, maxLength } from '../util';
import { CommandHelpFormatter } from './command-help-formatter';

type Options = Record<string, AliasedOption>;

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
          ([, { spec }]) => Boolean(spec.required) === required
        )
      )
        .when(
          (v) => v.length,
          (o) =>
            parts.push(
              `${required ? 'Required' : 'Optional'} Flags:`,
              '',
              this.printOptions(o, width)
            )
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
          `[choices: ${(option as OptionChoicesVariant).choices.join(', ')}]`
      )
      .otherwise((type) => `[${type}]`);
  }

  private printOptions(
    options: [string, { aliases: string[]; spec: Option }][],
    width: number
  ) {
    const data = options.map(([key, { aliases, spec }]) => [
      aliases.map((v) => `-${v}`).join(', ') + (aliases.length > 0 ? ',' : ''),
      `--${key}`,
      this.printOptionType(spec),
      spec.description ?? '',
    ]);

    return table(data, {
      border: getBorderCharacters('void'),
      columns: (() => {
        const widths = [
          maxLength(data.map(([v]) => v)),
          maxLength(data.map(([, v]) => v)),
          Math.min(24, maxLength(data.map(([, , v]) => v))),
        ];
        return [
          { paddingLeft: 2, paddingRight: 0, width: widths[0] },
          { width: widths[1] },
          { width: widths[2], wrapWord: true },
          {
            paddingLeft: 4,
            width: width - widths.reduce((s, v) => s + v + 2, 0) - 6,
            wrapWord: true,
          },
        ];
      })(),
      drawHorizontalLine: () => false,
    });
  }
}
export default new DefaultCommandHelpFormatter();
