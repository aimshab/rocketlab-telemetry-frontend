import { ApiError } from './ApiError';
import type { NewTelemetryEntry, TelemetryEntry, TelemetryQueryFilters } from '../types';

/**
 * Client for the real Satellite Telemetry API (see `backend/README.md`):
 *
 *   GET    /telemetry?satelliteId=&status=&page=&limit=
 *   POST   /telemetry
 *   GET    /telemetry/:id
 *   DELETE /telemetry/:id
 *
 * Active when `VITE_API_MODE` is unset or `"real"` (see `telemetryApi.ts`).
 *
 * Requests go to `VITE_API_BASE_URL` (default `http://localhost:3000`). The
 * backend sends CORS headers, so the browser can call it directly from the
 * Vite origin without a proxy.
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
const MAX_PAGE_LIMIT = 100;

let simulateFailures = false;

/** Lets the UI opt in/out of forced failures (used by the demo "Simulate outage" toggle). */
export function setSimulateFailures(enabled: boolean): void {
  simulateFailures = enabled;
}

export function getSimulateFailures(): boolean {
  return simulateFailures;
}

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  hasMore: boolean;
}

/** Shape of a Pydantic/FastAPI 422 validation error entry. */
interface ValidationErrorItem {
  loc?: Array<string | number>;
  msg?: string;
}

function isValidationErrorItem(value: unknown): value is ValidationErrorItem {
  return typeof value === 'object' && value !== null && 'msg' in value;
}

async function parseErrorMessage(response: Response): Promise<{ message: string; details?: string[] }> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { message: `Request failed with status ${response.status}.` };
  }

  const detail = (body as { detail?: unknown } | null)?.detail;

  if (Array.isArray(detail) && detail.every(isValidationErrorItem)) {
    const details = detail.map((item) => {
      const field = Array.isArray(item.loc) ? item.loc.filter((part) => part !== 'body').join('.') : undefined;
      return field ? `${field}: ${item.msg}` : item.msg ?? 'Invalid request.';
    });
    return { message: details.join(' '), details };
  }

  if (typeof detail === 'string') {
    return { message: detail };
  }

  const errorField = (body as { error?: unknown } | null)?.error;
  if (typeof errorField === 'string') {
    return { message: errorField };
  }

  return { message: `Request failed with status ${response.status}.` };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (simulateFailures) {
    throw new ApiError('Unable to reach the telemetry service. (Simulated outage.)');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(
      `Unable to reach the telemetry service${API_BASE_URL ? ` at ${API_BASE_URL}` : ''}. Is the API running?`,
    );
  }

  if (!response.ok) {
    const { message, details } = await parseErrorMessage(response);
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

/**
 * GET /telemetry?satelliteId=&status= — filtering happens on the server
 * (via query params), which matters once the table has more rows than fit
 * on one page: only the matching subset is ever downloaded. This still
 * walks every page of the (already-filtered) result set, since the API
 * caps `limit` at 100 and the UI doesn't have its own pagination controls.
 */
export async function getTelemetry(filters: TelemetryQueryFilters = {}): Promise<TelemetryEntry[]> {
  const items: TelemetryEntry[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await request<PaginatedResponse<TelemetryEntry>>(
      `/telemetry${buildQuery({
        page,
        limit: MAX_PAGE_LIMIT,
        satelliteId: filters.satelliteId,
        status: filters.status,
      })}`,
    );
    items.push(...data.items);
    hasMore = data.hasMore;
    page += 1;
  }

  return items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

/**
 * A single unfiltered page, used only to seed the Satellite ID filter
 * dropdown with real values without walking the entire (potentially large)
 * data set. Cheap and bounded regardless of how much data exists — trades
 * completeness (satellite IDs beyond the first 100 rows won't show up here)
 * for a fixed cost. `useTelemetry` tops this up as satellite IDs are seen in
 * filtered results and newly-created entries.
 */
export async function peekSatelliteIds(): Promise<string[]> {
  const data = await request<PaginatedResponse<TelemetryEntry>>(
    `/telemetry${buildQuery({ page: 1, limit: MAX_PAGE_LIMIT })}`,
  );
  return Array.from(new Set(data.items.map((item) => item.satelliteId)));
}

/** POST /telemetry */
export async function createTelemetry(input: NewTelemetryEntry): Promise<TelemetryEntry> {
  return request<TelemetryEntry>('/telemetry', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** DELETE /telemetry/:id */
export async function deleteTelemetry(id: string): Promise<void> {
  await request<void>(`/telemetry/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
