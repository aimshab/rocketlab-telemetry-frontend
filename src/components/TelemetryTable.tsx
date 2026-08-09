import { useState } from 'react';
import type { SortableColumn, SortDirection, TelemetryEntry } from '../types';
import { formatNumber, formatTimestamp } from '../utils/format';
import { HealthBadge } from './HealthBadge';
import { Spinner } from './Spinner';

interface TelemetryTableProps {
  entries: TelemetryEntry[];
  sortColumn: SortableColumn;
  sortDirection: SortDirection;
  onSortChange: (column: SortableColumn) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}

const COLUMNS: { key: SortableColumn; label: string }[] = [
  { key: 'timestamp', label: 'Timestamp (UTC)' },
  { key: 'altitude', label: 'Altitude (km)' },
  { key: 'velocity', label: 'Velocity (km/s)' },
];

function SortIndicator({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <span className="sort-indicator sort-indicator--idle">↕</span>;
  return <span className="sort-indicator">{direction === 'asc' ? '↑' : '↓'}</span>;
}

export function TelemetryTable({
  entries,
  sortColumn,
  sortDirection,
  onSortChange,
  onDelete,
  deletingId,
}: TelemetryTableProps) {
  // Deleting is destructive and irreversible, so the button click opens an
  // inline "are you sure?" state instead of firing onDelete right away. Only
  // one row can be mid-confirmation at a time — picking Delete on another
  // row implicitly cancels the previous one.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function handleConfirm(id: string) {
    setConfirmingId(null);
    onDelete(id);
  }

  return (
    <div className="table-wrap panel">
      <table className="telemetry-table">
        <thead>
          <tr>
            <th scope="col">Satellite ID</th>
            {COLUMNS.map((col) => (
              <th scope="col" key={col.key}>
                <button
                  type="button"
                  className="sort-button"
                  onClick={() => onSortChange(col.key)}
                  aria-sort={sortColumn === col.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {col.label}
                  <SortIndicator active={sortColumn === col.key} direction={sortDirection} />
                </button>
              </th>
            ))}
            <th scope="col">Health Status</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={6} className="table-empty">
                No telemetry entries match the current filters.
              </td>
            </tr>
          )}
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.satelliteId}</td>
              <td>{formatTimestamp(entry.timestamp)}</td>
              <td>{formatNumber(entry.altitude)}</td>
              <td>{formatNumber(entry.velocity)}</td>
              <td>
                <HealthBadge status={entry.status} />
              </td>
              <td>
                {confirmingId === entry.id ? (
                  <div className="delete-confirm">
                    <span className="delete-confirm__label">Delete this entry?</span>
                    <button
                      type="button"
                      className="button button--danger button--sm"
                      onClick={() => handleConfirm(entry.id)}
                      disabled={deletingId === entry.id}
                    >
                      {deletingId === entry.id ? <Spinner label="Deleting…" size="sm" /> : 'Yes, delete'}
                    </button>
                    <button
                      type="button"
                      className="button button--ghost button--sm"
                      onClick={() => setConfirmingId(null)}
                      disabled={deletingId === entry.id}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => setConfirmingId(entry.id)}
                    disabled={deletingId === entry.id}
                    aria-label={`Delete telemetry entry for ${entry.satelliteId}`}
                  >
                    {deletingId === entry.id ? <Spinner label="Deleting…" size="sm" /> : 'Delete'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
