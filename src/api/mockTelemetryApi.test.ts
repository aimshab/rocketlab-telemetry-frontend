import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './ApiError';
import {
  __resetStoreForTests,
  createTelemetry,
  deleteTelemetry,
  getTelemetry,
  peekSatelliteIds,
  setSimulateFailures,
} from './mockTelemetryApi';
import type { NewTelemetryEntry } from '../types';

const validEntry: NewTelemetryEntry = {
  satelliteId: 'SAT-TEST',
  timestamp: new Date().toISOString(),
  altitude: 500,
  velocity: 7.5,
  status: 'healthy',
};

describe('mockTelemetryApi', () => {
  beforeEach(() => {
    __resetStoreForTests([]);
  });

  it('returns entries sorted by timestamp descending', async () => {
    const older = { ...validEntry, timestamp: new Date(Date.now() - 10_000).toISOString() };
    const newer = { ...validEntry, timestamp: new Date().toISOString() };

    await createTelemetry(older);
    await createTelemetry(newer);

    const result = await getTelemetry();
    expect(result).toHaveLength(2);
    expect(result[0].timestamp).toBe(newer.timestamp);
    expect(result[1].timestamp).toBe(older.timestamp);
  });

  it('creates a new entry with a generated id', async () => {
    const created = await createTelemetry(validEntry);
    expect(created.id).toBeTruthy();
    expect(created.satelliteId).toBe('SAT-TEST');

    const all = await getTelemetry();
    expect(all.map((e) => e.id)).toContain(created.id);
  });

  it('filters by satelliteId and status server-side', async () => {
    await createTelemetry({ ...validEntry, satelliteId: 'SAT-A', status: 'healthy' });
    await createTelemetry({ ...validEntry, satelliteId: 'SAT-A', status: 'critical' });
    await createTelemetry({ ...validEntry, satelliteId: 'SAT-B', status: 'healthy' });

    expect((await getTelemetry({ satelliteId: 'SAT-A' })).every((e) => e.satelliteId === 'SAT-A')).toBe(true);
    expect((await getTelemetry({ satelliteId: 'SAT-A' }))).toHaveLength(2);
    expect((await getTelemetry({ status: 'healthy' }))).toHaveLength(2);
    expect((await getTelemetry({ satelliteId: 'SAT-A', status: 'critical' }))).toHaveLength(1);
    expect((await getTelemetry({ satelliteId: 'SAT-does-not-exist' }))).toHaveLength(0);
  });

  it('returns distinct known satellite ids', async () => {
    await createTelemetry({ ...validEntry, satelliteId: 'SAT-A' });
    await createTelemetry({ ...validEntry, satelliteId: 'SAT-A' });
    await createTelemetry({ ...validEntry, satelliteId: 'SAT-B' });

    const ids = await peekSatelliteIds();
    expect(ids.sort()).toEqual(['SAT-A', 'SAT-B']);
  });

  it('rejects invalid new entries, mirroring the real backend rules', async () => {
    await expect(createTelemetry({ ...validEntry, satelliteId: '' })).rejects.toThrow(ApiError);
    await expect(createTelemetry({ ...validEntry, altitude: 0 })).rejects.toThrow(ApiError);
    await expect(createTelemetry({ ...validEntry, altitude: -1 })).rejects.toThrow(ApiError);
    await expect(createTelemetry({ ...validEntry, velocity: Number.NaN })).rejects.toThrow(ApiError);
    await expect(createTelemetry({ ...validEntry, status: '' })).rejects.toThrow(ApiError);
  });

  it('deletes an existing entry', async () => {
    const created = await createTelemetry(validEntry);
    await deleteTelemetry(created.id);

    const all = await getTelemetry();
    expect(all.find((e) => e.id === created.id)).toBeUndefined();
  });

  it('throws when deleting a non-existent entry', async () => {
    await expect(deleteTelemetry('does-not-exist')).rejects.toThrow(ApiError);
  });

  it('simulates failures for all endpoints when enabled', async () => {
    setSimulateFailures(true);
    await expect(getTelemetry()).rejects.toThrow(ApiError);
    await expect(createTelemetry(validEntry)).rejects.toThrow(ApiError);
    await expect(deleteTelemetry('anything')).rejects.toThrow(ApiError);
  });
});
