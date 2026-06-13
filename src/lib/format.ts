// Display formatting helpers shared across panels.

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "2026-02-10" -> "Feb 10". Falls back to the raw string for non-ISO labels
// (e.g. the "(uploaded)" placeholder).
export function formatDayChip(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = MONTHS_SHORT[Number(m[2]) - 1] ?? m[2];
  return `${month} ${Number(m[3])}`;
}

// Distinct month-year context label, e.g. "February 2026" or "Feb–Mar 2026".
export function formatMonthYear(dates: string[]): string {
  const months = new Set<string>();
  const years = new Set<string>();
  for (const d of dates) {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(d);
    if (!m) continue;
    years.add(m[1]);
    months.add(MONTHS_LONG[Number(m[2]) - 1] ?? m[2]);
  }
  if (!months.size) return "";
  const monthPart =
    months.size === 1 ? [...months][0] : [...months].map((s) => s.slice(0, 3)).join("–");
  return `${monthPart} ${[...years].join("/")}`;
}

// Relative match time is stored in ms; spans are sub-second in this dataset.
export function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}
