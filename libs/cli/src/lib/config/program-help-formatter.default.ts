import { getBorderCharacters, table } from 'table';
import { Command } from '../command.types';
import { Aliased, ProgramMeta } from '../types';
import { getTtyWidth, maxLength } from '../util';
import { ProgramHelpFormatter } from './program-help-formatter';

export class DefaultProgramHelpFormatter implements ProgramHelpFormatter {
  format(
    meta: ProgramMeta,
    commands: Record<string, Aliased<Command<any, unknown>>>,
  ) {
    const width = getTtyWidth();

    const data = Object.entries(commands).map(([key, v]) => ({
      name: key,
      aliases: v.aliases.length ? `(aliases: ${v.aliases.join(', ')})` : '',
      description: v.value.metadata.description ?? '',
    }));

    const rows = data.map((v) => [
      v.name + (v.aliases && ` ${v.aliases}`),
      v.description,
    ]);

    const widths = {
      name: maxLength(rows.map((row) => row[0])),
    };

    return [
      meta?.description &&
        table([[meta.description]], {
          border: getBorderCharacters('void'),
          columns: [{ paddingLeft: 0, width: width - 4, wrapWord: true }],
        }),
      `Available Commands:`,
      '',
      table(rows, {
        border: getBorderCharacters('void'),
        columns: [
          { width: widths.name, paddingLeft: 2 },
          {
            width:
              width - 8 - Object.values(widths).reduce((s, v) => s + v + 2, 0),
            paddingLeft: 2,
            wrapWord: true,
          },
        ],
        drawHorizontalLine: () => false,
      }),
    ]
      .filter((v) => v !== undefined)
      .join('\n');
  }
}

export default new DefaultProgramHelpFormatter();
