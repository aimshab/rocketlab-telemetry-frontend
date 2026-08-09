/** Digits needed for `YYYY-MM-DD HH:mm:ss.SSS`. */
const TIMESTAMP_DIGIT_COUNT = 17;

/**
 * Formats a free-typed timestamp into `YYYY-MM-DD HH:mm:ss.SSS` as digits
 * are entered. Non-digits are ignored so separators can be typed or pasted
 * without fighting the mask.
 */
export function formatTimestampInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, TIMESTAMP_DIGIT_COUNT);

  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hour = digits.slice(8, 10);
  const minute = digits.slice(10, 12);
  const second = digits.slice(12, 14);
  const millisecond = digits.slice(14, 17);

  let formatted = year;
  if (digits.length > 4) formatted += `-${month}`;
  if (digits.length > 6) formatted += `-${day}`;
  if (digits.length > 8) formatted += ` ${hour}`;
  if (digits.length > 10) formatted += `:${minute}`;
  if (digits.length > 12) formatted += `:${second}`;
  if (digits.length > 14) formatted += `.${millisecond}`;
  return formatted;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/**
 * Formats a Date into the same UTC mask used by the timestamp text field.
 * The field is UTC (not the browser's local time) so it matches what the
 * backend stores and what the table displays.
 */
export function toTimestampInputValue(date: Date): string {
  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`,
  ].join(' ');
}

/**
 * Parses a fully-formed `YYYY-MM-DD HH:mm:ss[.SSS]` (or `T` separator) UTC
 * timestamp. Returns null when incomplete or not a real calendar datetime.
 */
export function parseTimestampInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number((match[7] ?? '0').padEnd(3, '0'));

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }

  return date;
}
