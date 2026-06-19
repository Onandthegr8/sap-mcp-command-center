// Number / currency formatting helpers. Indian Rupee (₹) with en-IN grouping (lakh/crore),
// e.g. "₹19,44,31,187" and compact "₹19.4Cr" / "₹21.4L".

const inrFull = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const number = new Intl.NumberFormat("en-IN");

export const formatInr = (v: number | null | undefined) => inrFull.format(v ?? 0);
export const formatInrCompact = (v: number | null | undefined) => inrCompact.format(v ?? 0);
export const formatNumber = (v: number | null | undefined) => number.format(v ?? 0);

/** "2025-03" -> "Mar 2025" for chart axes. */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return date.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}
