import readline from 'node:readline/promises';

export interface Prompter {
  boolean(args: { message: string; default?: boolean }): Promise<boolean>;
  // string(args: { message: string }): Promise<string>;
  // choices<T extends string>(args: { message: string, choices:T[] }): Promise<T>;
}

const TRUTHY = ['y', 'yes'] as readonly string[];
export class DefaultPrompter implements Prompter {
  async boolean({
    message,
    default: def = false,
  }: {
    message: string;
    default?: boolean;
  }) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await rl.question(`${message} [${def ? 'Y/n' : 'y/N'}] `);
    rl.close();
    return answer === '' ? def : TRUTHY.includes(answer.toLowerCase());
  }
}

export default new DefaultPrompter();
