import type { Unsubscribe } from '@why-ts/core';
import { Paths, Split } from 'type-fest';
import { z } from 'zod';

export const HandshakeKind = {
  Hello: 0,
  Ack: 1,
} as const;

export const ResultKind = {
  Success: 0,
  Failure: 1,
} as const;

export const WatchKind = {
  Subscribe: 0,
  Unsubscribe: 1,
  Value: 2,
} as const;

export const CommandKind = {
  Request: 0,
  Response: 1,
} as const;

export const MessageKind = {
  Handshake: -1,
  Command: 0,
  Event: 1,
  Watch: 2,
} as const;

export const HANDSHAKE_HELLO = {
  kind: MessageKind.Handshake,
  status: HandshakeKind.Hello,
} as const;

export const HANDSHAKE_ACK = {
  kind: MessageKind.Handshake,
  status: HandshakeKind.Ack,
} as const;

const RESULT_SCHEMA = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(ResultKind.Success), value: z.unknown() }),
  z.object({ kind: z.literal(ResultKind.Failure), error: z.unknown() }),
]);
const COMMAND_SCHEMA = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(CommandKind.Request),
    name: z.string(),
    args: z.array(z.unknown()).readonly(),
  }),
  z.object({
    kind: z.literal(CommandKind.Response),
    name: z.string(),
    result: RESULT_SCHEMA,
  }),
]);

const WATCH_SCHEMA = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(WatchKind.Subscribe) }),
  z.object({ kind: z.literal(WatchKind.Unsubscribe) }),
  z.object({ kind: z.literal(WatchKind.Value), value: z.unknown() }),
]);

export const MESSAGE_SCHEMA = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(MessageKind.Handshake),
    timestamp: z.number(),
    status: z.union([
      z.literal(HandshakeKind.Hello),
      z.literal(HandshakeKind.Ack),
    ]),
  }),
  z.object({
    kind: z.literal(MessageKind.Command),
    timestamp: z.number(),
    id: z.number(),
    command: COMMAND_SCHEMA,
  }),
  z.object({
    kind: z.literal(MessageKind.Event),
    timestamp: z.number(),
    name: z.string(),
    data: z.unknown(),
  }),
  z.object({
    kind: z.literal(MessageKind.Watch),
    timestamp: z.number(),
    name: z.string(),
    watch: WATCH_SCHEMA,
  }),
]);

export type Command = z.infer<typeof COMMAND_SCHEMA>;
export type Result = z.infer<typeof RESULT_SCHEMA>;
export type Message = z.infer<typeof MESSAGE_SCHEMA>;

export type Params = { local?: Base; remote?: Base };
type Base = {
  methods?: MethodBase;
  events?: EventBase;
  observables?: WatchBase;
};
export interface MethodBase {
  [key: string]: ((...args: any[]) => unknown) | MethodBase;
}
interface EventBase {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [key: string]: {} | Nested<EventBase>;
}
type WatchBase = Record<string, unknown>;

export type Drill<
  T extends Params,
  K extends keyof Params,
  F extends keyof Base,
  Fallback = Empty
> = T[K] extends object
  ? T[K][F] extends object
    ? T[K][F]
    : Fallback
  : Fallback;

export type LocalMethodsOf<P extends Params> = Drill<P, 'local', 'methods'>;
export type RemoteMethodsOf<P extends Params> = Drill<P, 'remote', 'methods'>;
export type LocalEventsOf<P extends Params> = Drill<P, 'local', 'events'>;
export type RemoteEventsOf<P extends Params> = Drill<P, 'remote', 'events'>;
export type LocalObservablesOf<P extends Params> = Drill<
  P,
  'local',
  'observables'
>;
export type RemoteObservablesOf<P extends Params> = Drill<
  P,
  'remote',
  'observables'
>;

export type Instance<P extends Params> = {
  ready: Promise<void>;
  remote: {
    methods: Call<RemoteMethodsOf<P>>;
    events: EventSubscriber<RemoteEventsOf<P>>;
    observables: WatchSubscriber<RemoteObservablesOf<P>>;
  };
  local: {
    events: EventEmitter<LocalEventsOf<P>>;
  };
  destroy: () => void;
};

export const DYNAMIC = Symbol('DYNAMIC'); // TODO: use Symbol.for
export type DynamicCall = (name: string, ...args: any[]) => Promise<unknown>;

type ToPath<S extends string> = Split<S, '.'>;
type Drill2<T, Path extends readonly string[]> = Part<T, T, Path> extends T
  ? never
  : Part<T, T, Path>;

type Part<
  Root,
  Current,
  Path extends readonly string[]
> = Path extends readonly []
  ? Current
  : Path extends [infer Head, ...infer Rest]
  ? Head extends keyof Current
    ? Rest extends readonly string[]
      ? Part<Root, Current[Head], Rest>
      : never
    : never
  : Current;

export type NamedCall<M extends MethodBase> = <K extends Paths<M> & string>(
  type: K,
  ...args: Parameters<Drill2<M, ToPath<K>>>
) => Promise<Awaited<ReturnType<Drill2<M, ToPath<K>>>>>;

export type Call<M extends MethodBase> = {
  [DYNAMIC]: DynamicCall;
} & RecursiveCall<M>;

type RecursiveCall<M extends MethodBase> = {
  [K in keyof M]: M[K] extends (...args: any[]) => unknown
    ? (...args: Parameters<M[K]>) => Promise<Awaited<ReturnType<M[K]>>>
    : M[K] extends MethodBase
    ? RecursiveCall<M[K]>
    : never;
};

declare const NESTED: unique symbol;
type NestedSignature = { [NESTED]: never };
export type Nested<T extends Record<string, unknown>> = NestedSignature & T;

type Empty = Record<string, never>;

export type DynamicEventSubscriber = (
  name: string,
  handler: (v: unknown) => void
) => Unsubscribe;

export type EventSubscriber<E extends EventBase> = {
  [DYNAMIC]: DynamicEventSubscriber;
} & RecursiveEventSubscriber<E>;

type RecursiveEventSubscriber<T extends EventBase> = {
  [K in keyof T]: T[K] extends NestedSignature
    ? T[K] extends EventBase
      ? RecursiveEventSubscriber<T[K]>
      : never
    : (handler: (v: T[K]) => void) => Unsubscribe;
};

export type NamedEventSubscriber<E extends EventBase> = <K extends keyof E>(
  type: K,
  handler: (v: E[K]) => void
) => Unsubscribe;

export type DynamicWatchSubscriber = (
  name: string,
  handler: (v: unknown) => void
) => Unsubscribe;

export type WatchSubscriber<W extends WatchBase> = {
  [DYNAMIC]: DynamicWatchSubscriber;
} & RecursiveWatchSubscriber<W>;

type RecursiveWatchSubscriber<T extends WatchBase> = {
  [K in keyof T & string]: T[K] extends NestedSignature
    ? T[K] extends WatchBase
      ? RecursiveWatchSubscriber<T[K]>
      : never
    : (handler: (v: T[K]) => void) => Unsubscribe;
};

export type NamedWatchSubscriber<W extends WatchBase> = <K extends keyof W>(
  name: K,
  handler: (v: W[K]) => void
) => Unsubscribe;

type X = WatchNotifier<{ n: Nested<{ a: string }> }>;

export type WatchNotifier<W extends WatchBase> = RecursiveWatchNotifier<W>;

type RecursiveWatchNotifier<T extends WatchBase> = {
  [K in keyof T & string]: T[K] extends NestedSignature
    ? T[K] extends WatchBase
      ? RecursiveWatchNotifier<T[K]>
      : never
    : (handler: (v: T[K]) => void) => Unsubscribe | undefined | null | void;
};

export type DynamicEventEmitter = (type: string, data: unknown) => void;

export type EventEmitter<E extends EventBase> = {
  [DYNAMIC]: DynamicEventEmitter;
} & RecursiveEventEmitter<E>;

type RecursiveEventEmitter<T extends EventBase> = {
  [K in keyof T]: T[K] extends NestedSignature
    ? T[K] extends EventBase
      ? RecursiveEventEmitter<T[K]>
      : never
    : (v: T[K]) => void;
};

export type NamedEventEmitter<E extends EventBase> = <K extends keyof E>(
  type: K,
  data: E[K]
) => void;

type Values<T> = T[keyof T];
type OmitNever<T> = Pick<
  T,
  Values<{
    [K in keyof T]: [T[K]] extends [never] ? never : K;
  }>
>;
export type InitArgs<P extends Params> = OmitNever<{
  methods: Drill<P, 'local', 'methods', never>;
  observables: Drill<P, 'local', 'observables', never> extends never
    ? never
    : WatchNotifier<LocalObservablesOf<P>>;
}>;
