import { get } from 'http';

export enum PromiseStatus {
  Pending,
  Resolved,
  Rejected,
}
export type PromiseTrigger<T> = {
  status: PromiseStatus;
  promise: Promise<T>;
  resolve: (result: T) => void;
  reject: (error: any) => void;
};
export function createPromiseTrigger<T>(): PromiseTrigger<T> {
  let resolve: ((v: T) => void) | undefined = undefined;
  let reject: ((e: any) => void) | undefined = undefined;
  let status = PromiseStatus.Pending;
  const promise = new Promise<T>((res, rej) => {
    resolve = (v) => {
      res(v);
      status = PromiseStatus.Resolved;
    };
    reject = (e) => {
      rej(e);
      status = PromiseStatus.Rejected;
    };
  });
  if (!resolve || !reject)
    throw new Error('PromiseTrigger is not correctly initialized');
  return {
    resolve,
    reject,
    promise,
    get status() {
      return status;
    },
  } as const;
}

Promise.allSettled;
