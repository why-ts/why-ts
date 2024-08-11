import type { Unsubscribe } from '@why-ts/core';
import mitt, { Emitter } from 'mitt';
import { Message } from '../irpc.types';
import { Transport } from './transport';

type Events = {
  a: Message;
  b: Message;
};

export class LocalBridgeTransport implements Transport {
  private constructor(
    private emitter: Emitter<Events>,
    private input: keyof Events,
    private output: keyof Events
  ) {}

  send(message: Message) {
    this.emitter.emit(this.output, message);
  }

  subscribe(handler: (message: Message) => void): Unsubscribe {
    this.emitter.on(this.input, handler);
    return () => this.emitter.off(this.input, handler);
  }

  static make() {
    const emitter = mitt<Events>();
    return {
      a: new LocalBridgeTransport(emitter, 'a', 'b'),
      b: new LocalBridgeTransport(emitter, 'b', 'a'),
    };
  }
}
