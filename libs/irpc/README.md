# Bi-directional reactive protocol

Real-time, type-safe data flow without the hassle.

## Operations

- **Method**  
  Call a remote function (RPC)
- **Event**  
  Listen to remote events
- **Observable**  
  Subscribe to remote observable values

In the following documentation, the code that provide implementations is called `server`
and the code that consumes the implementation remotely is called `client`

### Method

Allows client to invoke a function implemented in the server side, and optionally gets a value back.

To define and implement remotely-callable methods:

1. invoke the irpc constructor with a generic type parameter `{local: {methods: MyMethods}}`
2. provide implementations in the `methods` field in the constructor

```ts
type MyMethods = { add(a:number, b:number) => number }
const server = init<{ local: { methods: MyMethods } }>(
  transport,
  { methods: {add: (a, b) => a + b} }
);
```

To consume the remote methods:

1. invoke the irpc constructor with a generic type parameter `{remote: {methods: MyMethods}}`
2. invoke the methods via `instance.remote.methods`

```ts
const client = init<{ remote: { methods: MyMethods } }>(
  transport,
  {}
);
const sum = await client.remote.methods.add(2, 3); // sum = 5
```

### Event

Allow clients to subscribe to events emitted from the server side.

To define and implement remotely-listenable events:

1. invoke the irpc constructor with a generic type parameter `{local: {events: MyEvents}}`
2. emit the event via `instance.local.events`

```ts
type MyEvents = { tick: number };
const server = init<{ local: { events: MyEvents } }>(
  transport, 
  {}
);

// emit the event every second
setInterval(() => server.local.events.tick(Date.now()), 1000);
```

To listen to the remote events:

1. invoke the irpc constructor with a generic type parameter `{remote: {events: MyEvents}}`
2. invoke the Events via `instance.remote.events`

```ts
const client = init<{ remote: { events: MyEvents } }>(
  transport, 
  {}
);
const unsubscribe = client.remote.events.tick((time) => console.log(time));

// unsubscribe later
unsubscribe();
```

### Observable

Observable is very similar to Event, but it is lazy.
The observable logic is only initiated on the first subscription and will not re-initiate for subsequent subscriptions.
Also the teardown logic will only be run when the last subscriber unsubscribes.

To define and implement remotely-observable values:

1. invoke the irpc constructor with a generic type parameter `{local: {observables: MyObservables}}`
2. provide implementations in the `observables` field in the constructor

```ts
type MyObservables = { foo: number };
const server = init<{ local: { observables: MyObservables } }>(
  transport, {
  observables: (callback) => {
    const timer = setInterval(() => callback(new Date()), 50);
    return () => clearInterval(timer);
  },
});
```

To subscribe to the remote observables:

1. invoke the irpc constructor with a generic type parameter `{remote: {observables: MyObservables}}`
2. invoke the Observables via `instance.remote.observables`

```ts
const client = init<{ remote: { observables: MyObservables } }>(
  transport, 
  {}
);
const unsubscribe = client.remote.observables.foo((val) => console.log(val));

// unsubscribe later
unsubscribe();
```

### Untyped Access

Access the API in a untyped-manner via the `DYNAMIC` symbol.

```ts
const sum = await client.remote.methods[DYNAMIC]('add', 2, 3); // sum = 5
```


## Transport

Transport is the implementation that actually delivers the data.
The implementation dictates what and how data types are "transmitted" to the remote side.

- `LocalBridgeTransport`  
  In-memory tranport, mainly for testing. Since all data lives in the same program memory, all data types are supported.
- `PostMessageTransport`  
  Built on top of browser's `postMessage` API, mainly for communication between iframes or workers. Check the docs of `postMessage` to find out what data types are supported. The `transfer` option is also exposed so one can decide to transfer the data instead of cloning it.
- `WebSocketTransport`: (coming soon)

## TODO

- Validation of payload data type (command args and return values, etc)
- Allow parameters when subscribing to an observable
- Properly teardown/reset stuff when disconnect
