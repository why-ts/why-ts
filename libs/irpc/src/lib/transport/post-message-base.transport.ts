import type { Unsubscribe } from '@why-ts/core';
import { z } from 'zod';
import { MESSAGE_SCHEMA, Message, Params } from '../irpc.types';
import { Transferer, TransfererOptions } from './transferer';
import { Transport } from './transport';

const META_SCHEMA = z.object({
  '.irpc.transport': z.literal('post-message'),
});
const META: z.infer<typeof META_SCHEMA> = { '.irpc.transport': 'post-message' };

export class PostMessageTransportBase<
  P extends Params,
  Options extends StructuredSerializeOptions = StructuredSerializeOptions
> implements Transport
{
  private transferer: Transferer<P>;
  private sendTarget: SendTarget<Options>;
  private subscribeTarget: SubscribeTarget;
  private sendOptions?: Omit<Options, keyof StructuredSerializeOptions>;

  constructor(options: {
    sendTarget: SendTarget<Options>;
    subscribeTarget: SubscribeTarget;
    sendOptions?: Omit<Options, keyof StructuredSerializeOptions>;
    options?: { transfer?: TransfererOptions<P> };
  }) {
    this.sendTarget = options.sendTarget;
    this.subscribeTarget = options.subscribeTarget;
    this.sendOptions = options.sendOptions;
    this.transferer = new Transferer(options.options?.transfer);
  }

  send(message: Message) {
    this.sendTarget.postMessage({ ...META, ...message }, {
      transfer: this.transferer.getTransferables(message),
      ...this.sendOptions,
    } as Options);
  }

  subscribe(handler: (message: Message) => void): Unsubscribe {
    const listener = (event: MessageEvent) => {
      try {
        META_SCHEMA.parse(event.data);
        handler(MESSAGE_SCHEMA.parse(event.data));
      } catch (e) {
        // console.error(e);
      }
    };

    this.subscribeTarget.addEventListener('message', listener);
    return () => this.subscribeTarget.removeEventListener('message', listener);
  }
}

type SendTarget<Options extends StructuredSerializeOptions> = {
  postMessage(message: any, options?: Options): void;
};
type SubscribeTarget = {
  addEventListener(
    type: 'message',
    listener: (ev: MessageEvent) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: 'message',
    listener: (ev: MessageEvent) => any,
    options?: boolean | EventListenerOptions
  ): void;
};
