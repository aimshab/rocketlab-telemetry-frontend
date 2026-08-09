import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSimulateFailures } from '../api/telemetryApi';
import type { TelemetryEntry } from '../types';
import { useTelemetry } from './useTelemetry';

const seedEntry: TelemetryEntry = {
  id: 'seed-1',
  satelliteId: 'SAT-001',
  timestamp: new Date().toISOString(),
  altitude: 700,
  velocity: 7.5,
  status: 'healthy',
};

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

function mockList(items: TelemetryEntry[]) {
  return jsonResponse({ items, page: 1, limit: 100, hasMore: false });
}

/**
 * On mount the hook fires two requests: the (filtered) entries fetch and a
 * one-off unfiltered "peek" used to seed the Satellite ID dropdown. Tests
 * queue a response for both, in that order.
 */
function mockInitialLoad(entries: TelemetryEntry[]) {
  vi.mocked(fetch).mockResolvedValueOnce(mockList(entries)).mockResolvedValueOnce(mockList(entries));
}

describe('useTelemetry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    setSimulateFailures(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads entries on mount', async () => {
    mockInitialLoad([seedEntry]);

    const { result } = renderHook(() => useTelemetry());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('re-fetches from the server when filters change', async () => {
    mockInitialLoad([seedEntry]);

    const { result, rerender } = renderHook(({ filters }) => useTelemetry(filters), {
      initialProps: { filters: {} as { satelliteId?: string; status?: string } },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const filtered: TelemetryEntry = { ...seedEntry, id: 'seed-2', satelliteId: 'SAT-002' };
    vi.mocked(fetch).mockResolvedValueOnce(mockList([filtered]));

    rerender({ filters: { satelliteId: 'SAT-002' } });
    await waitFor(() => expect(result.current.entries).toEqual([filtered]));

    const calls = vi.mocked(fetch).mock.calls;
    const lastCallUrl = calls[calls.length - 1][0] as string;
    expect(lastCallUrl).toContain('satelliteId=SAT-002');
  });

  it('adds a new entry and refreshes under the current filter', async () => {
    mockInitialLoad([seedEntry]);

    const { result } = renderHook(() => useTelemetry());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const newEntry: TelemetryEntry = {
      id: 'new-1',
      satelliteId: 'SAT-002',
      timestamp: new Date().toISOString(),
      altitude: 600,
      velocity: 7.4,
      status: 'warning',
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(newEntry, { status: 201 }))
      .mockResolvedValueOnce(mockList([newEntry, seedEntry]));

    let success = false;
    await act(async () => {
      success = await result.current.addEntry({
        satelliteId: newEntry.satelliteId,
        timestamp: newEntry.timestamp,
        altitude: newEntry.altitude,
        velocity: newEntry.velocity,
        status: newEntry.status,
      });
    });

    expect(success).toBe(true);
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries.some((e) => e.satelliteId === 'SAT-002')).toBe(true);
    expect(result.current.satelliteIds).toContain('SAT-002');
  });

  it('removes an entry', async () => {
    mockInitialLoad([seedEntry]);

    const { result } = renderHook(() => useTelemetry());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => undefined,
    } as unknown as Response);

    await act(async () => {
      await result.current.removeEntry('seed-1');
    });

    expect(result.current.entries).toHaveLength(0);
  });

  it('surfaces an error message when the API fails', async () => {
    mockInitialLoad([seedEntry]);

    const { result } = renderHook(() => useTelemetry());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toMatch(/unable to reach/i);
  });
});
