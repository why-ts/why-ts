import { Params } from '../irpc.types';
import { PostMessageTransportBase } from './post-message-base.transport';
import { TransfererOptions } from './transferer';
import { Transport } from './transport';

export class PostMessageTransport<P extends Params>
  extends PostMessageTransportBase<P, WindowPostMessageOptions>
  implements Transport
{
  constructor(
    target: Window,
    options?: { targetOrigin?: string; transfer?: TransfererOptions<P> }
  ) {
    const { targetOrigin = '*', transfer } = options ?? {};
    super({
      sendTarget: target,
      subscribeTarget: window.self,
      sendOptions: { targetOrigin },
      options: { transfer },
    });
  }
}
