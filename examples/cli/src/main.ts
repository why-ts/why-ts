import { command, option as o, program } from '@why-ts/cli';
import { match } from 'ts-pattern';
import prompTestCommand from './prompt-test/command';

(async () => {
  const output = await program({
    description: 'Example CLI',
  })
    .command('prompt-test', prompTestCommand)
    .command(
      ['error', 'err', 'e'],
      command()
        .option(['message', 'm'], o.string())
        .handle(({ args }) => {
          throw new Error(args.message ?? 'An error occurred\n at main.ts:1:1');
        }),
    )
    .command(
      'generate',
      command({
        description: 'Generates random data based on specified parameters.',
      })
        .option(
          ['type', 't'],
          o.choice(['int', 'float', 'string', 'list', 'dict'] as const, {
            required: true,
            description: 'Specifies the type of data to generate.',
            fallback: () => 'int',
          }),
        )
        .option(
          ['range', 'r'],
          o.number({
            description:
              'Specifies the range of values (for integers and floats).',
            fallback: () => 100,
          }),
        )
        .option(
          ['length', 'l'],
          o.number({
            description:
              'Specifies the length of the generated data (for strings and lists).',
          }),
        )
        .option(
          ['count', 'c'],
          o.number({
            description:
              'Specifies the number of items to generate (for lists and dicts).',
          }),
        )
        .option(
          'seed',
          o.number({ description: 'Sets a random seed for reproducibility.' }),
        )
        .handle(() => 0),
    )
    .command(
      'flip',
      command({ description: 'Simulates a coin flip.' })
        .option(
          'bias',
          o.number({ description: 'Sets a bias for the coin (default: 0.5).' }),
        )
        .option(
          'count',
          o.number({ description: 'Specifies the number of flips.' }),
        )
        .handle(() => 0),
    )
    .command(
      'empty',
      command()
        .option('foo', o.number())
        .option('bar', o.number())
        .handle(() => 0),
    )
    .command(
      'gaussian',
      command({
        description:
          'The gaussian command generates random numbers following a normal (Gaussian) distribution. The mean and standard deviation parameters control the center and spread of the distribution, respectively. The -p flag allows you to specify the desired precision of the generated numbers.',
      })
        .option(
          'mean',
          o.number({
            description: 'Specifies the mean of the distribution.',
          }),
        )
        .option(
          'stddev',
          o.number({
            description:
              'Specifies the standard deviation of the distribution.',
          }),
        )
        .option(
          'count',
          o.number({
            description: 'Specifies the number of random numbers to generate.',
          }),
        )
        .option(
          'precision',
          o.number({
            description:
              'Specifies the number of decimal places to round the generated numbers to. This can be useful for controlling the output format and preventing excessive decimal places.',
          }),
        )
        .handle(() => 0),
    )

    .run(process.argv.slice(2))
    .catch(() => process.exit(1));

  match(output)
    .with({ kind: 'help' }, noop)
    .otherwise((output) => process.exit(output.result));
})();

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}
