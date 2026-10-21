/** Applies the display precision used for monetary summary values. */
export function roundToCents(value) {
  if (Math.abs(value) >= Number.MAX_VALUE / 100) return value;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
