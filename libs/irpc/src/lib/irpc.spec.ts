import { Mock, describe, expect, it, vi } from 'vitest';
import { init } from './irpc';
import { DYNAMIC, Nested } from './irpc.types';
import { LocalBridgeTransport, PostMessageTransport } from './transport';

type Methods = {
  foo: (v: number) => number;
  add: (v1: number, v2: number) => Promise<number>;
  nested: {
    bar: (v: number) => number;
  };
};

type Events = {
  time: Date;
  example: string;
  nonNested: { x: number; y: string };
  nested: Nested<{ x: number; y: string }>;
};
type Observables = {
  time: Date;
  example: string;
  nested: Nested<{ x: number; y: string }>;
};

const transport = LocalBridgeTransport.make();

describe('iRPC', () => {
  it('should resolve a value when a remote method is called', async () => {
    const methods = {
      foo: vi.fn((v: number) => v * v),
      add: vi.fn(async (v1: number, v2: number) => v1 + v2),
      nested: { bar: vi.fn((v: number) => v * v) },
    } as const;

    const server = init<{ local: { methods: Methods } }>(transport.a, {
      methods,
    });
    const client = init<{ remote: { methods: Methods } }>(transport.b, {});

    expect(await client.remote.methods.foo(2)).toBe(4);
    expect(await client.remote.methods[DYNAMIC]('foo', 2)).toBe(4);
    expect(methods.foo).toHaveBeenCalledWith(2);

    expect(await client.remote.methods.add(3, 4)).toBe(7);
    expect(methods.add).toHaveBeenCalledWith(3, 4);

    expect(await client.remote.methods.nested.bar(2)).toBe(4);
    expect(await client.remote.methods[DYNAMIC]('nested.bar', 2)).toBe(4);
    expect(methods.nested.bar).toHaveBeenCalledWith(2);

    client.destroy();
    server.destroy();
  });

  it('should reject when the remote method throws', async () => {
    const methods = {
      foo: vi.fn((v: number) => {
        throw new Error(`errored: ${v * v}`);
      }),
      add: vi.fn(async (v1: number, v2: number) => {
        throw new Error(`errored: ${v1 + v2}`);
      }),
      nested: {
        bar: vi.fn((v: number) => {
          throw new Error(`errored: ${v * v}`);
        }),
      },
    };
    const server = init<{ local: { methods: Methods } }>(transport.a, {
      methods,
    });
    const client = init<{ remote: { methods: Methods } }>(transport.b, {});

    await expect(() => client.remote.methods.foo(2)).rejects.toThrowError(
      'errored: 4'
    );
    expect(methods.foo).toHaveBeenCalledWith(2);

    await expect(() => client.remote.methods.add(3, 4)).rejects.toThrowError(
      'errored: 7'
    );
    expect(methods.add).toHaveBeenCalledWith(3, 4);

    server.destroy();
    client.destroy();
  });

  it('should reject when calling a undefined remote method', async () => {
    const methods = createMethods();

    const server = init<{ local: { methods: Methods } }>(transport.a, {
      methods,
    });
    const client = init<{ remote: { methods: Methods } }>(transport.b, {});

    await expect(() =>
      client.remote.methods[DYNAMIC]('bar', 1)
    ).rejects.toThrowError('Method "bar" not found');

    await expect(() =>
      client.remote.methods[DYNAMIC]('nested.baz', 1)
    ).rejects.toThrowError('Method "nested.baz" not found');

    client.destroy();
    server.destroy();
  });

  it('should handle a remote event', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();
    const handler4 = vi.fn();
    const handler5 = vi.fn();

    const server = init<{ local: { events: Events } }>(transport.a, {});
    const client = init<{ remote: { events: Events } }>(transport.b, {});

    await Promise.all([client.ready, server.ready]);

    client.remote.events.example(handler1);
    server.local.events.example('hello');

    client.remote.events[DYNAMIC]('time', handler2);
    server.local.events[DYNAMIC]('time', new Date());

    client.remote.events.nested.x(handler3);
    server.local.events[DYNAMIC]('nested.x', 2);

    client.remote.events.nested.y(handler4);
    server.local.events.nested.y('foo');

    client.remote.events.nonNested(handler5);
    server.local.events.nonNested({ x: 42, y: 'foo' });

    await sleep(10);
    expect(handler1).toHaveBeenCalledWith('hello');
    expect(handler2).toHaveBeenCalled();
    expect(handler3).toHaveBeenCalledWith(2);
    expect(handler4).toHaveBeenCalledWith('foo');
    expect(handler5).toHaveBeenCalledWith({ x: 42, y: 'foo' });

    server.destroy();
    client.destroy();
  });

  it('should observe a value', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const observables = {
      time: vi.fn((cb: (v: Date) => void) => {
        const x = setInterval(() => cb(new Date()), 50);
        return () => clearInterval(x);
      }),
      example: () => {
        /* noop */
      },
      nested: {
        x: vi.fn((cb: (v: number) => void) => {
          const x = setInterval(() => cb(Date.now()), 50);
          return () => clearInterval(x);
        }),
        y: vi.fn((cb: (v: string) => void) => {
          const x = setInterval(() => cb(new Date().toString()), 50);
          return () => clearInterval(x);
        }),
      },
    };

    const server = init<{ local: { observables: Observables } }>(transport.a, {
      observables,
    });
    const client = init<{ remote: { observables: Observables } }>(
      transport.b,
      {}
    );

    await Promise.all([client.ready, server.ready]);

    client.remote.observables.time(handler1);
    client.remote.observables.nested.x(handler2);

    await sleep(120);

    expect(handler1).toHaveBeenCalledTimes(2);
    expect(handler2).toHaveBeenCalledTimes(2);

    server.destroy();
    client.destroy();
  });
  it('should unobserve a value', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const status: Record<string, string[]> = {};
    const observables = {
      time: vi.fn((cb: (v: Date) => void) => {
        (status['time'] ??= []).push('sub');

        const x = setInterval(() => cb(new Date()), 50);
        return () => {
          (status['time'] ??= []).push('unsub');
          clearInterval(x);
        };
      }),
      example: () => {
        /* noop */
      },
      nested: {
        x: vi.fn((cb: (v: number) => void) => {
          (status['nested.x'] ??= []).push('sub');
          const x = setInterval(() => cb(Date.now()), 50);
          return () => {
            (status['nested.x'] ??= []).push('unsub');
            clearInterval(x);
          };
        }),
        y: () => {
          /* noop */
        },
      },
    };

    const server = init<{ local: { observables: Observables } }>(transport.a, {
      observables,
    });
    const client = init<{ remote: { observables: Observables } }>(
      transport.b,
      {}
    );

    await Promise.all([client.ready, server.ready]);

    const unsubscribe1 = client.remote.observables.time(handler1);
    const unsubscribe2 = client.remote.observables.nested.x(handler2);

    await sleep(120);
    unsubscribe1();
    unsubscribe2();

    await sleep(120);
    expect(status['time']).toEqual(['sub', 'unsub']);
    expect(observables.time).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledTimes(2);

    expect(status['nested.x']).toEqual(['sub', 'unsub']);
    expect(observables.nested.x).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(2);

    server.destroy();
    client.destroy();
  });

  it('should properly handle duplicated observations', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const status: Record<string, string[]> = {};

    const observables = {
      time: vi.fn((cb: (v: Date) => void) => {
        (status['time'] ??= []).push('sub');
        const x = setInterval(() => cb(new Date()), 50);
        return () => {
          (status['time'] ??= []).push('unsub');
          clearInterval(x);
        };
      }),
      example: () => {
        /* noop */
      },
      nested: {
        x: vi.fn((cb: (v: number) => void) => {
          const x = setInterval(() => cb(Date.now()), 50);
          return () => clearInterval(x);
        }),
        y: vi.fn((cb: (v: string) => void) => {
          const x = setInterval(() => cb(new Date().toString()), 50);
          return () => clearInterval(x);
        }),
      },
    };

    const server = init<{ local: { observables: Observables } }>(transport.a, {
      observables,
    });
    const client = init<{ remote: { observables: Observables } }>(
      transport.b,
      {}
    );

    await Promise.all([client.ready, server.ready]);

    const unsubscribe1 = client.remote.observables.time(handler1);
    const unsubscribe2 = client.remote.observables.time(handler2);

    await sleep(120);
    unsubscribe1();

    await sleep(20);
    expect(status['time']).toEqual(['sub']);
    unsubscribe2();

    await sleep(120);
    expect(status['time']).toEqual(['sub', 'unsub']);
    expect(observables.time).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledTimes(2);
    expect(handler2).toHaveBeenCalledTimes(2);

    server.destroy();
    client.destroy();
  });
});

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function createMethods(): Methods {
  return {
    foo: vi.fn((v: number) => v * v),
    add: vi.fn(async (v1: number, v2: number) => v1 + v2),
    nested: { bar: vi.fn((v: number) => v * v) },
  };
}
