import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TelemetryFilters, type TelemetryFilterState } from './TelemetryFilters';

const baseFilters: TelemetryFilterState = { satelliteId: 'All', status: 'All' };

describe('TelemetryFilters', () => {
  it('lists the provided satellite ids and status options', () => {
    render(
      <TelemetryFilters
        filters={baseFilters}
        satelliteIds={['SAT-001', 'SAT-002']}
        statusOptions={['healthy', 'critical']}
        onChange={vi.fn()}
        resultCount={2}
      />,
    );

    expect(screen.getByRole('option', { name: 'SAT-001' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SAT-002' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'healthy' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'critical' })).toBeInTheDocument();
  });

  it('calls onChange when the satellite filter changes', async () => {
    const onChange = vi.fn();
    render(
      <TelemetryFilters
        filters={baseFilters}
        satelliteIds={['SAT-001']}
        statusOptions={['healthy']}
        onChange={onChange}
        resultCount={1}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText(/satellite id/i), 'SAT-001');
    expect(onChange).toHaveBeenCalledWith({ satelliteId: 'SAT-001', status: 'All' });
  });

  it('calls onChange when the health status filter changes', async () => {
    const onChange = vi.fn();
    render(
      <TelemetryFilters
        filters={baseFilters}
        satelliteIds={['SAT-001']}
        statusOptions={['healthy', 'critical']}
        onChange={onChange}
        resultCount={1}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText(/health status/i), 'critical');
    expect(onChange).toHaveBeenCalledWith({ satelliteId: 'All', status: 'critical' });
  });

  it('shows a clear filters button only when filters are active', () => {
    const { rerender } = render(
      <TelemetryFilters
        filters={baseFilters}
        satelliteIds={['SAT-001']}
        statusOptions={['healthy']}
        onChange={vi.fn()}
        resultCount={1}
      />,
    );
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();

    rerender(
      <TelemetryFilters
        filters={{ satelliteId: 'SAT-001', status: 'All' }}
        satelliteIds={['SAT-001']}
        statusOptions={['healthy']}
        onChange={vi.fn()}
        resultCount={1}
      />,
    );
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });
});
