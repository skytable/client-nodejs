export function isFloat(number: number): boolean {
  return Number.isFinite(number) && !Number.isInteger(number);
}
