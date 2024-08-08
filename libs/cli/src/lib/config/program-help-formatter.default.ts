import { getBorderCharacters, table } from 'table';
import { Command } from '../command';
import { ProgramMeta } from '../types';
import { getTtyWidth, maxLength } from '../util';
import { ProgramHelpFormatter } from './program-help-formatter';

export class DefaultProgramHelpFormatter implements ProgramHelpFormatter {
  format(meta: ProgramMeta, commands: Record<string, Command<any, any>>) {
    const width = getTtyWidth();

    return [
      meta?.description &&
        table([[meta.description]], {
          border: getBorderCharacters('void'),
          columns: [{ paddingLeft: 0, width: width - 4, wrapWord: true }],
        }),
      `Available Commands:`,
      '',
      table(
        Object.entries(commands).map(([key, command]) => [
          key,
          command.metadata.description ?? '',
        ]),
        {
          border: getBorderCharacters('void'),
          columns: (() => {
            const width1 = maxLength(Object.keys(commands));
            return [
              { paddingLeft: 2, width: width1 },
              { paddingLeft: 4, width: width - 8 - width1, wrapWord: true },
            ];
          })(),
          drawHorizontalLine: () => false,
        }
      ),
    ]
      .filter((v) => v !== undefined)
      .join('\n');
  }
}

export default new DefaultProgramHelpFormatter();
