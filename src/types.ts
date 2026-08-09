/**
 * The backend treats `status` as a free-form, non-empty string (see
 * `backend/app/models.py`). These are just the values the sample/seed data
 * uses; the UI falls back gracefully for any other string the API returns.
 */
export const KNOWN_STATUSES = ['healthy', 'warning', 'critical'] as const;
export type KnownStatus = (typeof KNOWN_STATUSES)[number];

export interface TelemetryEntry {
  id: string;
  satelliteId: string;
  /** ISO-8601 timestamp string */
  timestamp: string;
  /** Altitude in kilometers */
  altitude: number;
  /** Velocity in kilometers per second */
  velocity: number;
  /** Health status, e.g. "healthy" | "warning" | "critical" */
  status: string;
}

export type NewTelemetryEntry = Omit<TelemetryEntry, 'id'>;

/** Server-side filter params for `GET /telemetry` (both clients honor these). */
export interface TelemetryQueryFilters {
  satelliteId?: string;
  status?: string;
}

export type SortableColumn = 'timestamp' | 'altitude' | 'velocity';

export type SortDirection = 'asc' | 'desc';
