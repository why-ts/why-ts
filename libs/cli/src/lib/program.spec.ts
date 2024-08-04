import { command } from './command';
import * as o from './option';
import { program } from './program';

jest.mock('figlet/importable-fonts/Standard', () => undefined);
describe('Program', () => {
  const slient = program({
    logger: {
      log: () => void 0,
      error: () => void 0,
    },
  });
  const c1 = command()
    .option('foo', o.string())
    .handle(({ args }) => args.foo);
  const c2 = command()
    .option('bar', o.string())
    .handle(({ args }) => args.bar === 'bar');
  const p = slient.command('c1', c1).command('c2', c2);

  it('should run a command and return args and results', async () => {
    expect(await p.run(['c1', '--foo', 'bar'])).toEqual({
      command: 'c1',
      args: expect.objectContaining({ foo: 'bar' }),
      result: 'bar',
    });
    expect(await p.run(['c2', '--bar', 'baz'])).toEqual({
      command: 'c2',
      args: expect.objectContaining({ bar: 'baz' }),
      result: false,
    });
    expect(await p.run(['c2', '--bar', 'bar'])).toEqual({
      command: 'c2',
      args: expect.objectContaining({ bar: 'bar' }),
      result: true,
    });
  });

  it('should throw if no args provided', async () => {
    expect(p.run([])).rejects.toThrow('No command provided');
  });

  it('should throw for undefined command', async () => {
    expect(p.run(['c3'])).rejects.toThrow('Command "c3" not found');
  });

  it('should return immutable program objects', async () => {
    const base = slient.command(
      'base',
      command().handle(() => 'base')
    );
    const p1 = base.command(
      'c1',
      command().handle(() => 'c1')
    );
    const p2 = base.command(
      'c2',
      command().handle(() => 'c2')
    );

    await expect(p1.run(['c2'])).rejects.toThrowError('Command "c2" not found');
    await expect(p2.run(['c1'])).rejects.toThrowError('Command "c1" not found');
  });
});
