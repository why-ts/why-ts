import { inspect } from 'util';

export function peek<T>(
  v: T,
  options?: {
    enabled?: (v: T) => boolean;
    transform?: (v: T) => unknown;
    inspect?: boolean;
  },
): T {
  const enabled = options?.enabled ?? ((v) => true);
  const transform = options?.transform ?? ((v) => v);

  if (enabled(v)) {
    const transformed = transform(v);
    console.log(
      options?.inspect
        ? inspect(transformed, { depth: 10, colors: true })
        : transformed,
    );
  }
  return v;
}
