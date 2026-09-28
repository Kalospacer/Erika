/** shields-style number formatting: 9 -> "9", 4200 -> "4.2k", 1234567 -> "1.2M". */

function trim1(v: number): string {
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return "-" + formatNumber(-n);
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return trim1(n / 1000) + "k";
  return trim1(n / 1_000_000) + "M";
}
