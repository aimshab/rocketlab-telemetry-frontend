import * as mockApi from './mockTelemetryApi';
import * as realApi from './realTelemetryApi';
import type { NewTelemetryEntry, TelemetryEntry, TelemetryQueryFilters } from '../types';

export { ApiError } from './ApiError';

/**
 * Single entry point the rest of the app imports from. Which backend it
 * talks to is chosen by configuration (`VITE_API_MODE`), not by editing
 * imports:
 *
 *   VITE_API_MODE=real  (default) — the FastAPI backend in ../backend,
 *                                    via realTelemetryApi.ts
 *   VITE_API_MODE=mock            — a self-contained in-memory fake,
 *                                    via mockTelemetryApi.ts (no backend
 *                                    needed — handy for UI-only work/demos)
 *
 * Set it in `.env.local` (see `.env.example`) or inline, e.g.:
 *   VITE_API_MODE=mock npm run dev
 */

export type ApiMode = 'mock' | 'real';

interface TelemetryApiClient {
  getTelemetry: (filters?: TelemetryQueryFilters) => Promise<TelemetryEntry[]>;
  peekSatelliteIds: () => Promise<string[]>;
  createTelemetry: (input: NewTelemetryEntry) => Promise<TelemetryEntry>;
  deleteTelemetry: (id: string) => Promise<void>;
  setSimulateFailures: (enabled: boolean) => void;
  getSimulateFailures: () => boolean;
}

function resolveApiMode(): ApiMode {
  const configured = (import.meta.env.VITE_API_MODE ?? 'real').toString().trim().toLowerCase();
  return configured === 'mock' ? 'mock' : 'real';
}

export const apiMode: ApiMode = resolveApiMode();

const client: TelemetryApiClient = apiMode === 'mock' ? mockApi : realApi;

export const getTelemetry = client.getTelemetry;
export const peekSatelliteIds = client.peekSatelliteIds;
export const createTelemetry = client.createTelemetry;
export const deleteTelemetry = client.deleteTelemetry;
export const setSimulateFailures = client.setSimulateFailures;
export const getSimulateFailures = client.getSimulateFailures;
