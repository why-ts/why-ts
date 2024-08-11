import { z } from 'zod';
import { Params } from '../irpc.types';
import { PostMessageTransportBase } from './post-message-base.transport';
import { TransfererOptions } from './transferer';
import { Transport } from './transport';

const META_SCHEMA = z.object({
  '.irpc.transport': z.literal('post-message'),
});
const META: z.infer<typeof META_SCHEMA> = { '.irpc.transport': 'post-message' };

export class WorkerSelfTransport<P extends Params>
  extends PostMessageTransportBase<P>
  implements Transport
{
  constructor(options?: { transfer?: TransfererOptions<P> }) {
    super({
      sendTarget: self,
      subscribeTarget: self,
      options,
    });
  }
}
