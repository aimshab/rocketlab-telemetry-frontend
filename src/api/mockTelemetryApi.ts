import { ApiError } from './ApiError';
import type { NewTelemetryEntry, TelemetryEntry, TelemetryQueryFilters } from '../types';

/**
 * A self-contained, in-memory stand-in for the real backend (see
 * `realTelemetryApi.ts`). Useful for developing/demoing the UI without the
 * FastAPI service running — enable it by setting `VITE_API_MODE=mock` (see
 * `telemetryApi.ts` and the README).
 *
 * Network latency and failures are simulated so the UI's loading and
 * error-handling paths behave the same way regardless of which client is
 * active.
 */

const NETWORK_DELAY_MS = 400;

let simulateFailures = false;

/** Lets the UI opt in/out of simulated failures (used by the demo "Simulate outage" toggle). */
export function setSimulateFailures(enabled: boolean): void {
  simulateFailures = enabled;
}

export function getSimulateFailures(): boolean {
  return simulateFailures;
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tlm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function seedData(): TelemetryEntry[] {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  return [
    {
      id: createId(),
      satelliteId: 'SAT-001',
      timestamp: new Date(now - 1 * hour).toISOString(),
      altitude: 705.2,
      velocity: 7.53,
      status: 'healthy',
    },
    {
      id: createId(),
      satelliteId: 'SAT-001',
      timestamp: new Date(now - 3 * hour).toISOString(),
      altitude: 703.8,
      velocity: 7.54,
      status: 'healthy',
    },
    {
      id: createId(),
      satelliteId: 'SAT-002',
      timestamp: new Date(now - 2 * hour).toISOString(),
      altitude: 550.1,
      velocity: 7.61,
      status: 'warning',
    },
    {
      id: createId(),
      satelliteId: 'SAT-003',
      timestamp: new Date(now - 5 * hour).toISOString(),
      altitude: 420.6,
      velocity: 7.68,
      status: 'critical',
    },
    {
      id: createId(),
      satelliteId: 'SAT-002',
      timestamp: new Date(now - 6 * hour).toISOString(),
      altitude: 548.9,
      velocity: 7.6,
      status: 'healthy',
    },
  ];
}

let store: TelemetryEntry[] = seedData();

function delay(ms = NETWORK_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maybeThrow(): void {
  if (simulateFailures) {
    throw new ApiError('Unable to reach the telemetry service. (Simulated outage.)');
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validateNewEntry(input: NewTelemetryEntry): void {
  if (!input.satelliteId?.trim()) {
    throw new ApiError('Satellite ID is required.', 422);
  }
  if (!input.timestamp || Number.isNaN(Date.parse(input.timestamp))) {
    throw new ApiError('A valid timestamp is required.', 422);
  }
  if (typeof input.altitude !== 'number' || Number.isNaN(input.altitude) || input.altitude <= 0) {
    throw new ApiError('Altitude must be greater than 0.', 422);
  }
  if (typeof input.velocity !== 'number' || Number.isNaN(input.velocity) || input.velocity <= 0) {
    throw new ApiError('Velocity must be greater than 0.', 422);
  }
  if (!input.status?.trim()) {
    throw new ApiError('Health status is required.', 422);
  }
}

/** GET /telemetry?satelliteId=&status= — filters the in-memory store, mirroring the real backend's exact-match semantics. */
export async function getTelemetry(filters: TelemetryQueryFilters = {}): Promise<TelemetryEntry[]> {
  await delay();
  maybeThrow();
  return clone(store)
    .filter((entry) => {
      const matchesSatellite = !filters.satelliteId || entry.satelliteId === filters.satelliteId;
      const matchesStatus = !filters.status || entry.status === filters.status;
      return matchesSatellite && matchesStatus;
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

/** Mirrors `realTelemetryApi.peekSatelliteIds` for API-surface parity (the mock has no real pagination limit, so this just returns every distinct id). */
export async function peekSatelliteIds(): Promise<string[]> {
  await delay();
  maybeThrow();
  return Array.from(new Set(store.map((entry) => entry.satelliteId)));
}

/** POST /telemetry */
export async function createTelemetry(input: NewTelemetryEntry): Promise<TelemetryEntry> {
  await delay();
  maybeThrow();
  validateNewEntry(input);

  const entry: TelemetryEntry = { id: createId(), ...input };
  store = [entry, ...store];
  return clone(entry);
}

/** DELETE /telemetry/:id */
export async function deleteTelemetry(id: string): Promise<void> {
  await delay();
  maybeThrow();

  const exists = store.some((entry) => entry.id === id);
  if (!exists) {
    throw new ApiError(`Telemetry entry "${id}" was not found.`, 404);
  }
  store = store.filter((entry) => entry.id !== id);
}

/** Test-only helper to reset the in-memory store to a known state. */
export function __resetStoreForTests(entries: TelemetryEntry[] = seedData()): void {
  store = entries;
  simulateFailures = false;
}
