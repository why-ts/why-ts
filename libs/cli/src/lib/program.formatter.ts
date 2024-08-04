import { Command } from './command';
import { ProgramMeta as Meta } from './types';

// unfortunately, table-layout does not have types
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Table from 'table-layout';

export type HelpFormatter = (
  meta: Meta,
  commands: Record<string, Command<any, any>>
) => string;

function table<T>(arr: T[]) {
  return new Table(arr, { maxWidth: process.stdout.columns }).toString();
}

const defaultHelpFormatter: HelpFormatter = (meta, commands) => {
  return [
    meta?.description,
    meta?.description && '',
    '',
    `Available Commands:`,
    '',
    table(
      Object.entries(commands).map(([key, command]) => ({
        key,
        description: command.metadata.description,
      }))
    ),
  ]
    .filter((v) => v !== undefined)
    .join('\n');
};
export default defaultHelpFormatter;
