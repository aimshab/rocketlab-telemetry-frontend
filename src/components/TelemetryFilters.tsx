export interface TelemetryFilterState {
  satelliteId: string;
  status: string;
}

interface TelemetryFiltersProps {
  filters: TelemetryFilterState;
  satelliteIds: string[];
  statusOptions: string[];
  onChange: (filters: TelemetryFilterState) => void;
  resultCount: number;
}

export function TelemetryFilters({ filters, satelliteIds, statusOptions, onChange, resultCount }: TelemetryFiltersProps) {
  const hasActiveFilters = filters.satelliteId !== 'All' || filters.status !== 'All';

  return (
    <section className="panel filters" aria-label="Filter telemetry data">
      <div className="filters__field">
        <label htmlFor="filter-satellite-id">Satellite ID</label>
        <select
          id="filter-satellite-id"
          value={filters.satelliteId}
          onChange={(e) => onChange({ ...filters, satelliteId: e.target.value })}
        >
          <option value="All">All satellites</option>
          {satelliteIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      <div className="filters__field">
        <label htmlFor="filter-health-status">Health Status</label>
        <select
          id="filter-health-status"
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
        >
          <option value="All">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="filters__meta">
        <span>
          {resultCount} {resultCount === 1 ? 'entry' : 'entries'}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onChange({ satelliteId: 'All', status: 'All' })}
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}
