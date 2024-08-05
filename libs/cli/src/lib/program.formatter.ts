import { Command } from './command';
import { ProgramMeta as Meta } from './types';
import { getBorderCharacters, table } from 'table';
import { getTtyWidth, maxLength } from './util';

export type HelpFormatter = (
  meta: Meta,
  commands: Record<string, Command<any, any>>
) => string;

const defaultHelpFormatter: HelpFormatter = (meta, commands) => {
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
};

export default defaultHelpFormatter;
