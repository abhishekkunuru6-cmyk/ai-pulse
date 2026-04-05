const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Formats a number into a compact human-readable string.
 *
 * Examples: 842 -> "842", 1200 -> "1.2K", 3400000 -> "3.4M"
 */
export function formatCompactNumber(n: number): string {
  return compactFormatter.format(n);
}
