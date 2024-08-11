export function drill<T = unknown>(
  target: unknown,
  field: string
): T | undefined {
  return field
    .split('.')
    .reduce((obj, key) => (!obj ? undefined : obj[key]), target as any);
}
