import { command } from './command';
import * as o from './option';

const CHOICES = ['bar', 'baz'] as const;
describe('Command', () => {
  const slient = command({
    logger: {
      log: () => void 0,
      error: () => void 0,
    },
  });

  it('should parse string', async () => {
    const output = await slient
      .option('foo', o.string())
      .handle(({ args }) => args.foo)
      .run(['--foo', 'bar']);
    expect(output.result === 'bar').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should parse single arg as string array', async () => {
    const output = await slient
      .option('foo', o.strings())
      .handle(({ args }) => args.foo)
      .run(['--foo', 'bar']);
    expect(output.result?.length === 1).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
    expect(output.result?.[0] === 'bar').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should parse multiple args as string array', async () => {
    const output = await slient
      .option('foo', o.strings())
      .handle(({ args }) => args.foo)
      .run(['--foo', 'bar', '--foo', '42']);
    expect(output.result?.length === 2).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
    expect(output.result?.[0] === 'bar').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
    expect(output.result?.[1] === '42').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should parse choices', async () => {
    const output = await slient
      .option('foo', o.choices(CHOICES))
      .handle(({ args }) => args.foo)
      .run(['--foo', 'bar']);
    expect(output.result === 'bar').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should throw if output not accepted by the choices', async () => {
    await expect(
      slient
        .option('foo', o.choices(CHOICES))
        .handle(({ args }) => args.foo)
        .run(['--foo', 'barbaz'])
    ).rejects.toThrow('--foo must be one of [bar, baz], but got barbaz');
  });

  it('should parse number', async () => {
    const output = await slient
      .option('foo', o.number())
      .handle(({ args }) => args.foo)
      .run(['--foo=42']);
    expect(output.result === 42).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should parse boolean', async () => {
    const output = await slient
      .option('foo', o.boolean())
      .handle(({ args }) => args.foo)
      .run(['--foo']);
    expect(output.result).toBe(true);
  });

  it('should parse single arg as number array', async () => {
    const output = await slient
      .option('foo', o.numbers())
      .handle(({ args }) => args.foo)
      .run(['--foo', '42']);
    expect(output.result?.length === 1).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
    expect(output.result?.[0] === 42).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should parse multiple args as number array', async () => {
    const output = await slient
      .option('foo', o.numbers())
      .handle(({ args }) => args.foo)
      .run(['--foo', '2', '--foo', '42']);
    expect(output.result?.length === 2).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
    expect(output.result?.[0] === 2).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
    expect(output.result?.[1] === 42).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should fail to parse string as number array', async () => {
    await expect(() =>
      slient
        .option('foo', o.numbers())
        .handle(({ args }) => args.foo)
        .run(['--foo', 'bar', '--foo', '42'])
    ).rejects.toThrow('--foo must be an number but got [bar]');
  });

  it('should parse negated boolean', async () => {
    const output = await slient
      .option('foo', o.boolean())
      .handle(({ args }) => args.foo)
      .run(['--no-foo']);
    expect(output.result).toBe(false);
  });

  it('should parse zero as false', async () => {
    const output = await slient
      .option('foo', o.boolean())
      .handle(({ args }) => args.foo)
      .run(['--foo=0']);
    expect(output.result).toBe(false);
  });

  it('should parse "n" as false', async () => {
    const output = await slient
      .option('foo', o.boolean())
      .handle(({ args }) => args.foo)
      .run(['--foo=n']);
    expect(output.result).toBe(false);
  });
  it('should reject on missing required arg', async () => {
    await expect(
      slient
        .option('foo', o.string({ required: true }))
        .handle(({ args }) => args.foo)
        .run([])
    ).rejects.toThrowError('--foo is required');
  });

  it('should fill arg with env (string)', async () => {
    const output = await slient
      .option('foo', o.string({ env: 'NODE_ENV', required: true }))
      .handle(({ args }) => args.foo)
      .run([]);
    expect(output.result === 'test').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should fill arg with env (number)', async () => {
    const output = await slient
      .option('foo', o.number({ env: 'TS_JEST', required: true }))
      .handle(({ args }) => args.foo)
      .run([]);
    expect(output.result === 1).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should fill arg with fallback', async () => {
    const output = await slient
      .option('foo', o.string({ fallback: () => 'bar', required: true }))
      .handle(({ args }) => args.foo)
      .run([]);
    expect(output.result === 'bar').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should fill arg with fallback (choice)', async () => {
    const output = await slient
      .option(
        'foo',
        o.choices(CHOICES, {
          required: true,
          fallback: () => 'bar' as const,
        })
      )
      .handle(({ args }) => args.foo)
      .run([]);
    expect(output.result === 'bar').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should reject on fallback returning undefined for required arg', async () => {
    await expect(
      slient
        .option('foo', o.string({ fallback: () => undefined, required: true }))
        .handle(({ args }) => args.foo)
        .run([])
    ).rejects.toThrowError('--foo is required');
  });

  it('should resolve undefined with fallback returning undefined', async () => {
    const output = await slient
      .option('foo', o.string({ fallback: () => undefined }))
      .handle(({ args }) => args.foo)
      .run([]);
    expect(output.result).toBe(undefined);
  });

  it('should transform args to camel case', async () => {
    const output = await slient
      .option('foo-bar', o.string())
      .handle(({ args }) => args.fooBar)
      .run(['--foo-bar', 'baz']);
    expect(output.args.fooBar === 'baz').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
    expect(output.result === 'baz').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should return immutable command objects', async () => {
    const base = slient.option('foo', o.string({ required: true }));
    const c1 = base
      .option('bar', o.string({ required: true }))
      .handle(({ args }) => args.bar);
    const c2 = base
      .option('baz', o.string({ required: true }))
      .handle(({ args }) => args.baz);

    const o1 = await c1.run(['--foo', 'foo', '--bar', 'bar']);
    const o2 = await c2.run(['--foo', 'foo', '--baz', 'baz']);
    expect(o1.result === 'bar').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
    expect(o2.result === 'baz').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should fallback to env var if defined (string)', async () => {
    const output = await slient
      .option('foo-bar', o.string({ env: 'NODE_ENV' }))
      .handle(({ args }) => args.fooBar)
      .run([]);
    expect(output.args.fooBar === 'test').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
    expect(output.result === 'test').toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should fallback to env var if defined (number)', async () => {
    const output = await slient
      .option('foo-bar', o.number({ env: 'JEST_WORKER_ID' }))
      .handle(({ args }) => args.fooBar)
      .run([]);
    expect(output.args.fooBar && output.args.fooBar >= 1).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
    expect(output.result && output.result >= 1).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });

  it('should fallback to env var if defined (boolean)', async () => {
    const output = await slient
      .option('foo-bar', o.boolean({ env: 'JEST_WORKER_ID' }))
      .handle(({ args }) => args.fooBar)
      .run([]);
    expect(output.args.fooBar).toBe(true);
    expect(output.result).toBe(true);
  });

  it('should reject multiple values', async () => {
    await expect(
      slient
        .option('foo', o.string())
        .handle(({ args }) => args.foo)
        .run(['--foo=bar', '--foo=baz'])
    ).rejects.toThrowError(
      '--foo only accepts a single value but is specified multiple times with values: [bar, baz]'
    );
  });

  it('should provide previous handler when replacing', async () => {
    const output = await slient
      .option('foo', o.number({ required: true }))
      .handle(({ args }) => args.foo * args.foo)
      .option('bar', o.number({ required: true }))
      .handle(({ current, ...rest }) => current(rest) + rest.args.bar)
      .run(['--foo=2', '--bar=3']);
    expect(output.result === 7).toBe(true); // this === format is for type checking at compile time cause jest doesn't any type checking
  });
});
