/** "1 month", "2 months": the count with its noun agreeing, for the fixed English wording the app uses. */
export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
