export function maxLength(arr: string[]): number {
  return arr.reduce((acc, cur) => (cur.length > acc ? cur.length : acc), 0);
}

export function getTtyWidth(): number {
  let width = 80;
  if (typeof process !== 'undefined') {
    width = process.stdout.columns ?? 80;
  }
  return width;
}
