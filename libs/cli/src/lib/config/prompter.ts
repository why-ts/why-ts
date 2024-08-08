export interface Prompter {
  boolean(args: { message: string; default?: boolean }): Promise<boolean>;
  string(args: { message: string }): Promise<string>;
  strings(args: { message: string }): Promise<string[]>;
  number(args: { message: string }): Promise<number>;
  numbers(args: { message: string }): Promise<number[]>;
  choice<T extends string>(args: { message: string; choices: T[] }): Promise<T>;
}
