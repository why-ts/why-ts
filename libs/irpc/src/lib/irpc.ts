import type { Unsubscribe } from '@why-ts/core';
import { PromiseStatus, createPromiseTrigger, drill } from '@why-ts/core';
import mitt from 'mitt';
import { match } from 'ts-pattern';
import { DYNAMIC_PROXY_HANDLER } from './irpc.proxy';
import {
  Call,
  CommandKind,
  DynamicCall,
  DynamicEventEmitter,
  DynamicEventSubscriber,
  DynamicWatchSubscriber,
  EventEmitter,
  EventSubscriber,
  HANDSHAKE_ACK,
  HANDSHAKE_HELLO,
  InitArgs,
  Instance,
  LocalEventsOf,
  LocalMethodsOf,
  LocalObservablesOf,
  Message,
  MessageKind,
  Params,
  RemoteEventsOf,
  RemoteMethodsOf,
  RemoteObservablesOf,
  Result,
  ResultKind,
  WatchKind,
  WatchNotifier,
  WatchSubscriber,
} from './irpc.types';
import { Transport } from './transport';

export function init<P extends Params>(
  transport: Transport,
  args: InitArgs<P>,
  options?: { debug?: { name?: string } }
): Instance<P> {
  const { methods, observables } = args as {
    methods?: LocalMethodsOf<P>;
    observables?: WatchNotifier<LocalObservablesOf<P>>;
  };

  const remote = {
    events: mitt(),
    observables: mitt(),
  };

  const local = {
    listeners: new Listeners(),
    observations: new Observations<P>(observables),
  };

  const ready = createPromiseTrigger<void>();
  const clearHandshakeTimer = exponentialBackoffInterval(
    () => post({ ...HANDSHAKE_HELLO, timestamp: Date.now() }, { force: true }),
    50,
    300000
  );
  ready.promise.then(clearHandshakeTimer);

  function post(
    message: Message,
    opt?: {
      /** Send the message even the handshake is not completed */
      force?: boolean;
    }
  ) {
    function send() {
      if (options?.debug) console.log(options.debug?.name, 'send', message);
      transport.send(message);
    }

    if (opt?.force || ready.status === PromiseStatus.Resolved) send();
    else if (ready.status === PromiseStatus.Pending) ready.promise.then(send);
    // For the time being the handshake can't fail
  }

  function handleMessage(message: Message) {
    if (options?.debug) console.log(options.debug?.name, 'received', message);
    match(message)
      .with(HANDSHAKE_HELLO, () =>
        post({ ...HANDSHAKE_ACK, timestamp: Date.now() }, { force: true })
      )
      .with(HANDSHAKE_ACK, () => ready.resolve())
      .with({ kind: MessageKind.Command }, async ({ id, command }) =>
        match(command)
          .with({ kind: CommandKind.Request }, async ({ name, args }) => {
            const method = drill(methods, name);
            let result: Result;
            if (typeof method === 'function') {
              try {
                result = {
                  kind: ResultKind.Success,
                  value: await method(...args),
                };
              } catch (error) {
                result = { kind: ResultKind.Failure, error };
              }
            } else {
              result = {
                kind: ResultKind.Failure,
                error: new Error(`Method "${name}" not found`),
              };
            }

            post({
              kind: MessageKind.Command,
              timestamp: Date.now(),
              id,
              command: { kind: CommandKind.Response, name, result },
            });
          })
          .with({ kind: CommandKind.Response }, ({ result }) => {
            local.listeners.invoke(id, result);
          })
          .exhaustive()
      )
      .with({ kind: MessageKind.Event }, ({ name, data }) => {
        remote.events.emit(name, data);
      })
      .with({ kind: MessageKind.Watch }, ({ name, watch }) =>
        match(watch)
          .with({ kind: WatchKind.Subscribe }, () => {
            local.observations.subscribe(name, (data: unknown) =>
              post({
                kind: MessageKind.Watch,
                timestamp: Date.now(),
                name,
                watch: { kind: WatchKind.Value, value: data },
              })
            );
          })
          .with({ kind: WatchKind.Unsubscribe }, () => {
            local.observations.unsubscribe(name);
          })
          .with({ kind: WatchKind.Value }, ({ value }) => {
            remote.observables.emit(name, value);
          })
          .exhaustive()
      )
      .exhaustive();
  }

  const unsubscribe = transport.subscribe(handleMessage);

  return {
    ready: ready.promise,
    remote: {
      methods: new Proxy(
        ((name, ...args) =>
          new Promise<unknown>((resolve, reject) => {
            const id = getNextId();
            local.listeners.register(id, resolve, reject);
            post({
              kind: MessageKind.Command,
              timestamp: Date.now(),
              id,
              command: { kind: CommandKind.Request, name, args },
            });
          })) as DynamicCall,
        DYNAMIC_PROXY_HANDLER
      ) as unknown as Call<RemoteMethodsOf<P>>,

      events: new Proxy(
        ((type, handler) => {
          remote.events.on(type, handler);
          return () => remote.events.off(type, handler);
        }) as DynamicEventSubscriber,
        DYNAMIC_PROXY_HANDLER
      ) as unknown as EventSubscriber<RemoteEventsOf<P>>,

      observables: new Proxy(
        ((name, handler) => {
          // send a subscribe message to the other side if it is the first observer
          if (!remote.observables.all.get(name)?.length)
            post({
              kind: MessageKind.Watch,
              timestamp: Date.now(),
              name,
              watch: { kind: WatchKind.Subscribe },
            });
          remote.observables.on(name, handler);
          return () => {
            remote.observables.off(name, handler);
            // send an unsubscribe message to the other side if it is the last observer
            if (!remote.observables.all.get(name)?.length)
              post({
                kind: MessageKind.Watch,
                timestamp: Date.now(),
                name,
                watch: { kind: WatchKind.Unsubscribe },
              });
          };
        }) as DynamicWatchSubscriber,
        DYNAMIC_PROXY_HANDLER
      ) as unknown as WatchSubscriber<RemoteObservablesOf<P>>,
    },

    local: {
      events: new Proxy(
        ((name, data) =>
          post({
            kind: MessageKind.Event,
            timestamp: Date.now(),
            name,
            data,
          })) as DynamicEventEmitter,
        DYNAMIC_PROXY_HANDLER
      ) as unknown as EventEmitter<LocalEventsOf<P>>,
    },

    destroy: () => {
      local.observations.unsubscribeAll();
      unsubscribe();
    },
  };
}

const MAX = 2 ** 31 - 1;
let counter = (Math.random() * MAX) | 0;
function getNextId() {
  if (counter === MAX) counter = 0;
  return counter++;
}

class Observations<P extends Params> {
  private observations = new Map<
    string,
    { count: number; unsubscribe: Unsubscribe }
  >();

  constructor(private observables?: WatchNotifier<LocalObservablesOf<P>>) {}

  subscribe(name: string, cb: (data: unknown) => void) {
    const observation = this.observations.get(name);
    if (observation) {
      observation.count++;
    } else {
      const observable = drill(this.observables, name);
      if (typeof observable === 'function') {
        const unsubscribe = observable(cb);
        this.observations.set(name, {
          count: 1,
          unsubscribe: () => {
            unsubscribe?.();
            this.observations.delete(name);
          },
        });
      } else {
        console.warn(
          `Path "${name}" of ${this.observables} not found or not a function`
        );
      }
    }
  }

  unsubscribe(name: string) {
    const observation = this.observations.get(name);
    if (observation && --observation.count === 0) {
      observation.unsubscribe();
      this.observations.delete(name);
    }
  }

  unsubscribeAll() {
    this.observations.forEach(({ unsubscribe }, key) => {
      unsubscribe();
      this.observations.delete(key);
    });
  }
}

class Listeners {
  private map = new Map<number, (result: Result) => void>();

  register(
    id: number,
    resolve: (value: unknown) => void,
    reject: (error: unknown) => void
  ) {
    this.map.set(id, (result) => {
      if (result.kind === ResultKind.Success) {
        resolve(result.value);
      } else {
        reject(result.error);
      }
    });
  }

  invoke(id: number, result: Result) {
    const listener = this.map.get(id);
    if (listener) {
      listener(result);
      this.map.delete(id);
    }
  }
}

function exponentialBackoffInterval(
  fn: () => void,
  initialDelay = 100,
  maxDelay = Infinity,
  growthFactor = 2
): Unsubscribe {
  let currentDelay = initialDelay;
  let intervalId: ReturnType<typeof setTimeout>;

  const run = () => {
    fn(); // Execute the provided function

    currentDelay = Math.min(currentDelay * growthFactor, maxDelay); // Adjust delay

    intervalId = setTimeout(run, currentDelay); // Schedule next execution
  };

  intervalId = setTimeout(run, currentDelay); // Start the first run

  // Return an object for control
  return () => clearTimeout(intervalId);
}
