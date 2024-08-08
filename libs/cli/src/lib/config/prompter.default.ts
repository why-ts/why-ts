import prompts from 'prompts';
import { Prompter } from './prompter';

export class DefaultPrompter implements Prompter {
  async boolean({
    message,
    default: def = false,
  }: {
    message: string;
    default?: boolean;
  }) {
    const res = await prompts({
      type: 'confirm',
      name: 'value',
      message,
      initial: def,
    });
    return res.value;
  }

  async string({ message }: { message: string }): Promise<string> {
    const res = await prompts({
      type: 'text',
      name: 'value',
      message,
    });
    return res.value;
  }

  async strings({ message }: { message: string }): Promise<string[]> {
    const res = await prompts({
      type: 'list',
      name: 'value',
      message,
    });
    return res.value;
  }

  async number({ message }: { message: string }): Promise<number> {
    const res = await prompts({
      type: 'number',
      name: 'value',
      message,
    });
    return res.value;
  }

  async numbers({ message }: { message: string }): Promise<number[]> {
    const res = await prompts({
      type: 'list',
      name: 'value',
      message,
      format: (strings: string[]) => strings.map(parseFloat),
    });
    return res.value;
  }

  async choice<T extends string>({
    message,
    choices,
  }: {
    message: string;
    choices: T[];
  }): Promise<T> {
    const res = await prompts({
      type: 'select',
      name: 'value',
      message,
      choices: choices.map((c) => ({ title: c, value: c })),
    });
    return res.value;
  }
}

export default new DefaultPrompter();
