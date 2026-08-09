import { describe, expect, it } from 'vitest';
import { formatTimestampInput, parseTimestampInput, toTimestampInputValue } from './timestampInput';

describe('formatTimestampInput', () => {
  it('inserts separators as digits are typed', () => {
    expect(formatTimestampInput('2026')).toBe('2026');
    expect(formatTimestampInput('202608')).toBe('2026-08');
    expect(formatTimestampInput('20260806')).toBe('2026-08-06');
    expect(formatTimestampInput('2026080612')).toBe('2026-08-06 12');
    expect(formatTimestampInput('202608061230')).toBe('2026-08-06 12:30');
    expect(formatTimestampInput('20260806123045')).toBe('2026-08-06 12:30:45');
    expect(formatTimestampInput('20260806123045123')).toBe('2026-08-06 12:30:45.123');
  });

  it('strips non-digits and caps at millisecond precision', () => {
    expect(formatTimestampInput('2026-08-06T12:30:45.123Z')).toBe('2026-08-06 12:30:45.123');
    expect(formatTimestampInput('20260806123045123999')).toBe('2026-08-06 12:30:45.123');
  });
});

describe('parseTimestampInput', () => {
  it('parses a complete UTC timestamp including milliseconds', () => {
    const date = parseTimestampInput('2026-08-06 12:30:45.123');
    expect(date).not.toBeNull();
    expect(date!.toISOString()).toBe('2026-08-06T12:30:45.123Z');
    expect(date!.getUTCFullYear()).toBe(2026);
    expect(date!.getUTCMonth()).toBe(7);
    expect(date!.getUTCDate()).toBe(6);
    expect(date!.getUTCHours()).toBe(12);
    expect(date!.getUTCMinutes()).toBe(30);
    expect(date!.getUTCSeconds()).toBe(45);
    expect(date!.getUTCMilliseconds()).toBe(123);
  });

  it('rejects incomplete or impossible values', () => {
    expect(parseTimestampInput('2026-08-06 12:30')).toBeNull();
    expect(parseTimestampInput('2026-13-40 12:30:45.000')).toBeNull();
  });
});

describe('toTimestampInputValue', () => {
  it('round-trips through the input mask format in UTC', () => {
    const date = new Date(Date.UTC(2026, 7, 6, 12, 30, 45, 7));
    expect(toTimestampInputValue(date)).toBe('2026-08-06 12:30:45.007');
    expect(parseTimestampInput(toTimestampInputValue(date))?.getTime()).toBe(date.getTime());
  });
});
