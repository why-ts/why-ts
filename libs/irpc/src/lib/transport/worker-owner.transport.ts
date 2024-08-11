import { Params } from '../irpc.types';
import { PostMessageTransportBase } from './post-message-base.transport';
import { TransfererOptions } from './transferer';
import { Transport } from './transport';

export class WorkerOwnerTransport<P extends Params>
  extends PostMessageTransportBase<P>
  implements Transport
{
  constructor(target: Worker, options?: { transfer?: TransfererOptions<P> }) {
    super({
      sendTarget: target,
      subscribeTarget: target,
      options,
    });
  }
}
