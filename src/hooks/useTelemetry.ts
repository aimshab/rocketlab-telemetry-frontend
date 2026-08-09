import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, createTelemetry, deleteTelemetry, getTelemetry, peekSatelliteIds } from '../api/telemetryApi';
import { KNOWN_STATUSES, type NewTelemetryEntry, type TelemetryEntry, type TelemetryQueryFilters } from '../types';

interface UseTelemetryState {
  entries: TelemetryEntry[];
  satelliteIds: string[];
  statusOptions: string[];
  isLoading: boolean;
  error: string | null;
  isSubmitting: boolean;
  deletingId: string | null;
  refresh: () => Promise<void>;
  addEntry: (input: NewTelemetryEntry) => Promise<boolean>;
  removeEntry: (id: string) => Promise<void>;
  dismissError: () => void;
}

function toMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred.';
}

function union(existing: string[], incoming: string[]): string[] {
  const merged = new Set(existing);
  let changed = false;
  for (const value of incoming) {
    if (value && !merged.has(value)) {
      merged.add(value);
      changed = true;
    }
  }
  return changed ? Array.from(merged).sort() : existing;
}

/**
 * Owns all telemetry state: fetching, creating, deleting, loading and error
 * flags. Filtering happens server-side — `entries` is re-fetched from the
 * API (with `satelliteId`/`status` query params) whenever `filters` changes,
 * so the table only ever downloads what currently matches. Sorting stays
 * client-side, since the API has no sort param.
 *
 * The filter dropdowns need option lists independent of the current filter
 * (picking a satellite shouldn't remove other satellites from that same
 * dropdown), so `satelliteIds`/`statusOptions` are tracked separately from
 * `entries` and only ever grow: seeded once from a single unfiltered page
 * plus the known status values, then topped up from whatever the app
 * happens to see (fetched pages, newly-created entries).
 */
export function useTelemetry(filters: TelemetryQueryFilters = {}): UseTelemetryState {
  const { satelliteId, status } = filters;

  const [entries, setEntries] = useState<TelemetryEntry[]>([]);
  const [satelliteIds, setSatelliteIds] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([...KNOWN_STATUSES]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTelemetry({ satelliteId, status });
      setEntries(data);
      setSatelliteIds((prev) => union(prev, data.map((entry) => entry.satelliteId)));
      setStatusOptions((prev) => union(prev, data.map((entry) => entry.status)));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [satelliteId, status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Seed the Satellite ID dropdown once, independent of the active filter,
  // so it isn't limited to whatever the *current* filtered view happens to
  // contain.
  useEffect(() => {
    peekSatelliteIds()
      .then((ids) => setSatelliteIds((prev) => union(prev, ids)))
      .catch(() => {
        /* non-critical: dropdown just stays limited to values seen so far */
      });
  }, []);

  const addEntry = useCallback(
    async (input: NewTelemetryEntry): Promise<boolean> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const created = await createTelemetry(input);
        setSatelliteIds((prev) => union(prev, [created.satelliteId]));
        setStatusOptions((prev) => union(prev, [created.status]));
        // Re-fetch under the active filter rather than assuming the new
        // entry belongs in the current view — the entry may not match the
        // currently selected satellite/status filter.
        await refresh();
        return true;
      } catch (err) {
        setError(toMessage(err));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh],
  );

  const removeEntry = useCallback(async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await deleteTelemetry(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setDeletingId(null);
    }
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return useMemo(
    () => ({
      entries,
      satelliteIds,
      statusOptions,
      isLoading,
      error,
      isSubmitting,
      deletingId,
      refresh,
      addEntry,
      removeEntry,
      dismissError,
    }),
    [
      entries,
      satelliteIds,
      statusOptions,
      isLoading,
      error,
      isSubmitting,
      deletingId,
      refresh,
      addEntry,
      removeEntry,
      dismissError,
    ],
  );
}
