import { HandlerInput, OptionValueType } from '@why-ts/cli';

export default async function ({
  args: { type },
  prompter,
}: HandlerInput<{ type?: OptionValueType }>) {
  if (!type || type === 'string')
    print(await prompter.string({ message: 'Enter a string' }));
  if (!type || type === 'strings')
    print(await prompter.strings({ message: 'Enter a list of strings' }));
  if (!type || type === 'number')
    print(await prompter.number({ message: 'Enter a number' }));
  if (!type || type === 'numbers')
    print(await prompter.numbers({ message: 'Enter a list of numbers' }));
  if (!type || type === 'boolean')
    print(await prompter.boolean({ message: 'Confirm?' }));
  if (!type || type === 'choice')
    print(
      await prompter.choice({
        message: 'Select a fruit',
        choices: ['orange', 'apple', 'banana'],
      })
    );

  return 0;
}

function print(value: any) {
  console.log(value, `(${typeof value})`);
}
