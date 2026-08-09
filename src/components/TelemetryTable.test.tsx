import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TelemetryEntry } from '../types';
import { TelemetryTable } from './TelemetryTable';

const entries: TelemetryEntry[] = [
  {
    id: '1',
    satelliteId: 'SAT-001',
    timestamp: '2026-01-01T00:00:00.000Z',
    altitude: 700,
    velocity: 7.5,
    status: 'healthy',
  },
  {
    id: '2',
    satelliteId: 'SAT-002',
    timestamp: '2026-01-02T00:00:00.000Z',
    altitude: 500,
    velocity: 7.6,
    status: 'critical',
  },
];

describe('TelemetryTable', () => {
  it('renders a row per entry with formatted values and health badges', () => {
    render(
      <TelemetryTable
        entries={entries}
        sortColumn="timestamp"
        sortDirection="desc"
        onSortChange={vi.fn()}
        onDelete={vi.fn()}
        deletingId={null}
      />,
    );

    expect(screen.getByText('SAT-001')).toBeInTheDocument();
    expect(screen.getByText('SAT-002')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('shows an empty state when there are no entries', () => {
    render(
      <TelemetryTable
        entries={[]}
        sortColumn="timestamp"
        sortDirection="desc"
        onSortChange={vi.fn()}
        onDelete={vi.fn()}
        deletingId={null}
      />,
    );

    expect(screen.getByText(/no telemetry entries match/i)).toBeInTheDocument();
  });

  it('calls onSortChange with the clicked column', async () => {
    const onSortChange = vi.fn();
    render(
      <TelemetryTable
        entries={entries}
        sortColumn="timestamp"
        sortDirection="desc"
        onSortChange={onSortChange}
        onDelete={vi.fn()}
        deletingId={null}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /altitude/i }));
    expect(onSortChange).toHaveBeenCalledWith('altitude');
  });

  it('asks for confirmation before calling onDelete', async () => {
    const onDelete = vi.fn();
    render(
      <TelemetryTable
        entries={entries}
        sortColumn="timestamp"
        sortDirection="desc"
        onSortChange={vi.fn()}
        onDelete={onDelete}
        deletingId={null}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /delete telemetry entry for sat-001/i }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/delete this entry\?/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('cancels the confirmation without calling onDelete', async () => {
    const onDelete = vi.fn();
    render(
      <TelemetryTable
        entries={entries}
        sortColumn="timestamp"
        sortDirection="desc"
        onSortChange={vi.fn()}
        onDelete={onDelete}
        deletingId={null}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /delete telemetry entry for sat-001/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/delete this entry\?/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete telemetry entry for sat-001/i })).toBeInTheDocument();
  });

  it('only allows one row to be mid-confirmation at a time', async () => {
    render(
      <TelemetryTable
        entries={entries}
        sortColumn="timestamp"
        sortDirection="desc"
        onSortChange={vi.fn()}
        onDelete={vi.fn()}
        deletingId={null}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /delete telemetry entry for sat-001/i }));
    expect(screen.getByText(/delete this entry\?/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /delete telemetry entry for sat-002/i }));
    expect(screen.getByRole('button', { name: /delete telemetry entry for sat-001/i })).toBeInTheDocument();
    expect(screen.getByText(/delete this entry\?/i)).toBeInTheDocument();
  });

  it('shows a spinner and disables the button for the entry being deleted', () => {
    render(
      <TelemetryTable
        entries={entries}
        sortColumn="timestamp"
        sortDirection="desc"
        onSortChange={vi.fn()}
        onDelete={vi.fn()}
        deletingId="1"
      />,
    );

    const deletingButton = screen.getByRole('button', { name: /delete telemetry entry for sat-001/i });
    expect(deletingButton).toBeDisabled();
  });
});
