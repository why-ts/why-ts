import { DYNAMIC } from './irpc.types';

type Fn = (name: string, ...args: any[]) => unknown;
// ProxyTarget must be itself callable (has the [[Call]] internal method) in order for the "apply" trap to work
// so we augment a function type with a "path" property to keep track of the nested path
// https://stackoverflow.com/a/32360219/3212365
type TaggedFn = Fn & { path: string };

const NESTED_PROXY_HANDLER: ProxyHandler<TaggedFn> = {
  apply: (target, _, args) => target(target.path, ...args),
  get: (target, name) => {
    return new Proxy(
      makeTarget(target, `${target.path}.${name as string}`),
      NESTED_PROXY_HANDLER
    );
  },
};

export const DYNAMIC_PROXY_HANDLER: ProxyHandler<Fn> = {
  get: (target, name) => {
    if (name === DYNAMIC) return target;
    return new Proxy(makeTarget(target, name as string), NESTED_PROXY_HANDLER);
  },
};
function makeTarget(fn: Fn, path: string): TaggedFn {
  const ret = (name: string, ...args: unknown[]) => fn(name, ...args);
  ret.path = path;
  return ret;
}
