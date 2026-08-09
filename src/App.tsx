import { useMemo, useState } from 'react';
import './App.css';
import { apiMode, setSimulateFailures } from './api/telemetryApi';
import { ErrorBanner } from './components/ErrorBanner';
import { Spinner } from './components/Spinner';
import { TelemetryFilters, type TelemetryFilterState } from './components/TelemetryFilters';
import { TelemetryForm } from './components/TelemetryForm';
import { TelemetryTable } from './components/TelemetryTable';
import { useTelemetry } from './hooks/useTelemetry';
import type { SortableColumn, SortDirection } from './types';

const DEFAULT_FILTERS: TelemetryFilterState = { satelliteId: 'All', status: 'All' };

function App() {
  const [filters, setFilters] = useState<TelemetryFilterState>(DEFAULT_FILTERS);
  const [sortColumn, setSortColumn] = useState<SortableColumn>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [simulateOutage, setSimulateOutage] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Translate the "All" sentinel into "no filter" query params sent to the API.
  const apiFilters = useMemo(
    () => ({
      satelliteId: filters.satelliteId === 'All' ? undefined : filters.satelliteId,
      status: filters.status === 'All' ? undefined : filters.status,
    }),
    [filters],
  );

  const {
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
  } = useTelemetry(apiFilters);

  // Filtering already happened on the server; only sorting is left to do here.
  const visibleEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aValue = sortColumn === 'timestamp' ? Date.parse(a.timestamp) : a[sortColumn];
      const bValue = sortColumn === 'timestamp' ? Date.parse(b.timestamp) : b[sortColumn];
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [entries, sortColumn, sortDirection]);

  function handleSortChange(column: SortableColumn) {
    if (column === sortColumn) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function handleToggleOutage(checked: boolean) {
    setSimulateOutage(checked);
    setSimulateFailures(checked);
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Satellite Telemetry Dashboard</h1>
        </div>
        {import.meta.env.DEV && (
          <div className="app__header-controls">
            <span
              className={`api-mode-badge api-mode-badge--${apiMode}`}
              title={
                apiMode === 'mock'
                  ? 'VITE_API_MODE=mock — using the in-memory fake API (no backend needed).'
                  : 'VITE_API_MODE=real (default) — talking to the FastAPI backend via the dev proxy.'
              }
            >
              {apiMode === 'mock' ? 'Mock API' : 'Live API'}
            </span>
            <label className="outage-toggle" title="Demonstrates error handling by simulating a network outage">
              <input
                type="checkbox"
                checked={simulateOutage}
                onChange={(e) => handleToggleOutage(e.target.checked)}
              />
              Simulate backend outage
            </label>
          </div>
        )}
      </header>

      {error && <ErrorBanner message={error} onRetry={refresh} onDismiss={dismissError} />}

      <main className="app__main">
        {isFormOpen ? (
          <TelemetryForm onSubmit={addEntry} isSubmitting={isSubmitting} onCancel={() => setIsFormOpen(false)} />
        ) : (
          <button type="button" className="add-entry-trigger" onClick={() => setIsFormOpen(true)}>
            <span className="add-entry-trigger__icon" aria-hidden="true">
              +
            </span>
            Add Telemetry Entry
          </button>
        )}

        <TelemetryFilters
          filters={filters}
          satelliteIds={satelliteIds}
          statusOptions={statusOptions}
          onChange={setFilters}
          resultCount={visibleEntries.length}
        />

        {isLoading ? (
          <div className="panel table-loading">
            <Spinner label="Loading telemetry data…" />
          </div>
        ) : (
          <TelemetryTable
            entries={visibleEntries}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            onDelete={removeEntry}
            deletingId={deletingId}
          />
        )}
      </main>
    </div>
  );
}

export default App;
