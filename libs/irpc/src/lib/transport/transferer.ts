import { drill } from '@why-ts/core';
import { P, match } from 'ts-pattern';
import {
  CommandKind,
  LocalMethodsOf,
  Message,
  MessageKind,
  MethodBase,
  Params,
  RemoteMethodsOf,
  ResultKind,
} from '../irpc.types';

export type TransfererOptions<P extends Params> = {
  methods?: {
    requests?: RecursiveMethodRequestTransfer<RemoteMethodsOf<P>>;
    responses?: RecursiveMethodResponseTransfer<LocalMethodsOf<P>>;
  };
};

export class Transferer<P extends Params> {
  constructor(private options?: TransfererOptions<P>) {}

  getTransferables(message: Message): Transferable[] | undefined {
    return match(message)
      .with(
        {
          kind: MessageKind.Command,
          command: {
            kind: CommandKind.Request,
            name: P.select('name'),
            args: P.select('args'),
          },
        },
        ({ name, args }) => {
          const handler = drill<(...args: unknown[]) => Transferable[]>(
            this.options?.methods?.requests,
            name
          );
          return handler && handler(...args);
        }
      )
      .with(
        {
          kind: MessageKind.Command,
          command: {
            kind: CommandKind.Response,
            name: P.select('name'),
            result: { kind: ResultKind.Success, value: P.select('value') },
          },
        },
        ({ name, value }) => {
          const handler = drill<(value: unknown) => Transferable[]>(
            this.options?.methods?.responses,
            name
          );
          return handler && handler(value);
        }
      )
      .otherwise(() => undefined);
  }
}

type RecursiveMethodRequestTransfer<M extends MethodBase> = {
  [K in keyof M]?: M[K] extends (...args: any[]) => unknown
    ? (...args: Parameters<M[K]>) => Transferable[]
    : M[K] extends MethodBase
    ? RecursiveMethodRequestTransfer<M[K]>
    : never;
};
type RecursiveMethodResponseTransfer<M extends MethodBase> = {
  [K in keyof M]?: M[K] extends (...args: any[]) => unknown
    ? (arg: ReturnType<M[K]>) => Transferable[]
    : M[K] extends MethodBase
    ? RecursiveMethodResponseTransfer<M[K]>
    : never;
};
