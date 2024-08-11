import type { Unsubscribe } from '@why-ts/core';
import { Message } from '../irpc.types';

export interface Transport {
  send(message: Message): void;
  subscribe(handler: (message: Message) => void): Unsubscribe;
}
