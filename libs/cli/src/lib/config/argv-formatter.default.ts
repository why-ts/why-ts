import kleur from 'kleur';
import { ArgvFormatter } from './argv-formatter';

export class DefaultArgvFormatter implements ArgvFormatter {
  format(argv: string[]): string {
    return kleur.yellow(
      `> ${argv.map((v) => (v.includes(' ') ? `"${v}"` : v)).join(' ')}`
    );
  }
}

export default new DefaultArgvFormatter();
