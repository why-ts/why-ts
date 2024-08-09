import { getBorderCharacters, table } from 'table';
import kleur from 'kleur';
import { ErrorFormatter } from './error-formatter';
import { match, P } from 'ts-pattern';
import { CommandNotFoundError, InvalidArgsError } from '../error';
import { getTtyWidth } from '../util';

export class DefaultErrorFormatter implements ErrorFormatter {
  format(error: Error): string {
    const width = getTtyWidth();

    return table(
      [
        [
          kleur.bgRed(' ERROR '),
          match(error)
            .with(P.instanceOf(CommandNotFoundError), (e) =>
              kleur.red(`Command ${kleur.bold(e.command)} not found`)
            )
            .with(P.instanceOf(InvalidArgsError), ({ problems }) =>
              problems
                .map((p) =>
                  match(p)
                    .with({ kind: 'required' }, (v) =>
                      kleur.red(`--${kleur.bold(v.option)} option is required`)
                    )
                    .with(
                      { kind: 'custom-validation', message: undefined },
                      (v) =>
                        kleur.red(`--${kleur.bold(v.option)} option is invalid`)
                    )
                    .otherwise((v) =>
                      kleur.red(`--${kleur.bold(v.option)} option ${v.message}`)
                    )
                )
                .join('\n')
            )
            .otherwise((e) => kleur.red(e.message)),
        ],
      ],
      {
        border: getBorderCharacters('void'),
        columns: [{ width: 7 }, { width: width - 7 - 4 }],
      }
    );
  }
}

export default new DefaultErrorFormatter();
