import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './ApiError';
import {
  createTelemetry,
  deleteTelemetry,
  getTelemetry,
  peekSatelliteIds,
  setSimulateFailures,
} from './realTelemetryApi';
import type { NewTelemetryEntry, TelemetryEntry } from '../types';

const validEntry: NewTelemetryEntry = {
  satelliteId: 'SAT-TEST',
  timestamp: '2026-08-06T12:00:00.000Z',
  altitude: 500,
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

describe('telemetryApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    setSimulateFailures(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('walks every page and returns entries sorted by timestamp descending', async () => {
    const older: TelemetryEntry = { id: '1', ...validEntry, timestamp: '2026-08-06T10:00:00.000Z' };
    const newer: TelemetryEntry = { id: '2', ...validEntry, timestamp: '2026-08-06T14:00:00.000Z' };

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ items: [older], page: 1, limit: 100, hasMore: true }))
      .mockResolvedValueOnce(jsonResponse({ items: [newer], page: 2, limit: 100, hasMore: false }));

    const result = await getTelemetry();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('page=1');
    expect(fetchMock.mock.calls[1][0]).toContain('page=2');
    expect(result).toEqual([newer, older]);
  });

  it('sends satelliteId/status as query params so filtering happens on the server', async () => {
    const entry: TelemetryEntry = { id: '1', ...validEntry };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [entry], page: 1, limit: 100, hasMore: false }));

    const result = await getTelemetry({ satelliteId: 'SAT-TEST', status: 'healthy' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('satelliteId=SAT-TEST');
    expect(url).toContain('status=healthy');
    expect(result).toEqual([entry]);
  });

  it('peeks a single unfiltered page to seed known satellite ids', async () => {
    const a: TelemetryEntry = { id: '1', ...validEntry, satelliteId: 'SAT-A' };
    const b: TelemetryEntry = { id: '2', ...validEntry, satelliteId: 'SAT-B' };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [a, b], page: 1, limit: 100, hasMore: true }));

    const ids = await peekSatelliteIds();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('page=1');
    expect(url).not.toContain('satelliteId=');
    expect(ids.sort()).toEqual(['SAT-A', 'SAT-B']);
  });

  it('creates a new entry via POST with a JSON body', async () => {
    const created: TelemetryEntry = { id: 'abc-123', ...validEntry };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(created, { status: 201 }));

    const result = await createTelemetry(validEntry);

    expect(result).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/telemetry');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(validEntry);
  });

  it('deletes an entry via DELETE', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as unknown as Response);

    await deleteTelemetry('abc-123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/telemetry/abc-123');
    expect(init?.method).toBe('DELETE');
  });

  it('surfaces FastAPI 422 validation errors with field names', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          detail: [
            { type: 'greater_than', loc: ['body', 'altitude'], msg: 'Input should be greater than 0' },
          ],
        },
        { ok: false, status: 422 },
      ),
    );

    await expect(createTelemetry(validEntry)).rejects.toMatchObject({
      message: expect.stringContaining('altitude: Input should be greater than 0'),
    });
  });

  it('surfaces 404 errors with a plain string detail', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Telemetry entry not found' }, { ok: false, status: 404 }));

    await expect(deleteTelemetry('missing-id')).rejects.toThrow('Telemetry entry not found');
  });

  it('wraps network failures in an ApiError', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(getTelemetry()).rejects.toThrow(ApiError);
  });

  it('short-circuits every call when simulateFailures is enabled', async () => {
    setSimulateFailures(true);
    const fetchMock = vi.mocked(fetch);

    await expect(getTelemetry()).rejects.toThrow(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
