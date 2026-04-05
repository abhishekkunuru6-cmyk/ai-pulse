/**
 * Formats a date string as "Mar 22, 2026" or "Mar 22" (if same year).
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown date";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Formats a date range like "Mar 18 - Mar 22" or "Mar 22" (if same day).
 */
export function formatDateRange(oldest: string | null, latest: string | null): string {
  if (!oldest && !latest) return "Unknown";
  if (!oldest) return formatDate(latest);
  if (!latest) return formatDate(oldest);

  const oldDate = formatDate(oldest);
  const newDate = formatDate(latest);

  return oldDate === newDate ? newDate : `${oldDate} – ${newDate}`;
}

const MINUTE = 60;
const HOUR = 3_600;
const DAY = 86_400;
const WEEK = 604_800;
const MONTH = 2_592_000;
const YEAR = 31_536_000;

/**
 * Formats a date string into a human-readable relative time.
 * Returns "Unknown" for null or invalid dates.
 *
 * Examples: "2h ago", "1d ago", "3w ago", "just now"
 */
export function formatRelativeTime(dateString: string | null): string {
  if (dateString === null) {
    return "Unknown";
  }

  const timestamp = Date.parse(dateString);

  if (Number.isNaN(timestamp)) {
    return "Unknown";
  }

  const secondsAgo = Math.floor((Date.now() - timestamp) / 1_000);

  if (secondsAgo < 0) {
    return "just now";
  }

  if (secondsAgo < MINUTE) {
    return "just now";
  }

  if (secondsAgo < HOUR) {
    const minutes = Math.floor(secondsAgo / MINUTE);
    return `${minutes}m ago`;
  }

  if (secondsAgo < DAY) {
    const hours = Math.floor(secondsAgo / HOUR);
    return `${hours}h ago`;
  }

  if (secondsAgo < WEEK) {
    const days = Math.floor(secondsAgo / DAY);
    return `${days}d ago`;
  }

  if (secondsAgo < MONTH) {
    const weeks = Math.floor(secondsAgo / WEEK);
    return `${weeks}w ago`;
  }

  if (secondsAgo < YEAR) {
    const months = Math.floor(secondsAgo / MONTH);
    return `${months}mo ago`;
  }

  const years = Math.floor(secondsAgo / YEAR);
  return `${years}y ago`;
}
