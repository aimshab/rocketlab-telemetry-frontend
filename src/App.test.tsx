import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { setSimulateFailures } from './api/telemetryApi';
import type { TelemetryEntry } from './types';

const seed: TelemetryEntry[] = [
  {
    id: 'seed-1',
    satelliteId: 'SAT-001',
    timestamp: '2026-01-01T00:00:00.000Z',
    altitude: 700,
    velocity: 7.5,
    status: 'healthy',
  },
  {
    id: 'seed-2',
    satelliteId: 'SAT-002',
    timestamp: '2026-01-02T00:00:00.000Z',
    altitude: 500,
    velocity: 7.6,
    status: 'critical',
  },
];

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

/**
 * A minimal fake server, matching the real backend's `GET /telemetry?satelliteId=&status=`
 * exact-match filtering — App now sends these as query params instead of filtering
 * client-side, so the fake needs to honor them for the filtering tests to mean anything.
 */
function installFetchMock(items: TelemetryEntry[]) {
  let store = [...items];
  let nextId = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (method === 'GET' && url.includes('/telemetry')) {
      const params = new URL(url, 'http://localhost').searchParams;
      const satelliteId = params.get('satelliteId');
      const status = params.get('status');
      const filtered = store.filter(
        (entry) => (!satelliteId || entry.satelliteId === satelliteId) && (!status || entry.status === status),
      );
      return jsonResponse({ items: filtered, page: 1, limit: 100, hasMore: false });
    }
    if (method === 'POST' && url.includes('/telemetry')) {
      nextId += 1;
      const body = JSON.parse(init?.body as string);
      const created = { id: `new-${nextId}`, ...body };
      store = [created, ...store];
      return jsonResponse(created, { status: 201 });
    }
    if (method === 'DELETE') {
      const id = decodeURIComponent(url.split('/').pop() ?? '');
      store = store.filter((entry) => entry.id !== id);
      return { ok: true, status: 204, json: async () => undefined } as unknown as Response;
    }
    throw new Error(`Unhandled request in test: ${method} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * "SAT-001" etc. appear both as `<option>` text in the Satellite ID filter
 * dropdown and as `<td>` text in the table, so table-content assertions must
 * be scoped to the table to avoid ambiguous queries.
 */
function getTable() {
  return screen.getByRole('table');
}

describe('App', () => {
  beforeEach(() => {
    setSimulateFailures(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and displays telemetry data', async () => {
    installFetchMock(seed);
    render(<App />);

    expect(screen.getByText(/loading telemetry data/i)).toBeInTheDocument();
    await waitFor(() => expect(within(getTable()).getByText('SAT-001')).toBeInTheDocument());
    expect(within(getTable()).getByText('SAT-002')).toBeInTheDocument();
  });

  it('filters the table by satellite id and health status', async () => {
    installFetchMock(seed);
    render(<App />);
    await waitFor(() => expect(within(getTable()).getByText('SAT-001')).toBeInTheDocument());

    const filtersRegion = screen.getByRole('region', { name: /filter telemetry data/i });

    await userEvent.selectOptions(within(filtersRegion).getByLabelText(/satellite id/i), 'SAT-002');
    await waitFor(() => expect(within(getTable()).queryByText('SAT-001')).not.toBeInTheDocument());
    expect(within(getTable()).getByText('SAT-002')).toBeInTheDocument();

    await userEvent.selectOptions(within(filtersRegion).getByLabelText(/satellite id/i), 'All satellites');
    await userEvent.selectOptions(within(filtersRegion).getByLabelText(/health status/i), 'critical');
    await waitFor(() => expect(within(getTable()).queryByText('SAT-001')).not.toBeInTheDocument());
    expect(within(getTable()).getByText('SAT-002')).toBeInTheDocument();
  });

  it('keeps the add-entry form collapsed until the toggle button is clicked', async () => {
    installFetchMock(seed);
    render(<App />);
    await waitFor(() => expect(within(getTable()).getByText('SAT-001')).toBeInTheDocument());

    expect(screen.queryByRole('form', { name: /add telemetry entry/i })).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /add telemetry entry/i });
    await userEvent.click(trigger);
    const form = screen.getByRole('form', { name: /add telemetry entry/i });
    expect(form).toBeInTheDocument();

    await userEvent.click(within(form).getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('form', { name: /add telemetry entry/i })).not.toBeInTheDocument();
  });

  it('adds and then deletes a telemetry entry end-to-end', async () => {
    installFetchMock(seed);
    render(<App />);
    await waitFor(() => expect(within(getTable()).getByText('SAT-001')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /add telemetry entry/i }));
    const form = screen.getByRole('form', { name: /add telemetry entry/i });
    await userEvent.type(within(form).getByLabelText(/satellite id/i), 'SAT-003');
    await userEvent.type(within(form).getByLabelText(/altitude/i), '450');
    await userEvent.type(within(form).getByLabelText(/velocity/i), '7.7');
    await userEvent.click(within(form).getByRole('button', { name: /add entry/i }));

    await waitFor(() => expect(within(getTable()).getByText('SAT-003')).toBeInTheDocument());

    const row = within(getTable()).getByText('SAT-003').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: /delete/i }));
    await userEvent.click(within(row).getByRole('button', { name: /yes, delete/i }));

    await waitFor(() => expect(within(getTable()).queryByText('SAT-003')).not.toBeInTheDocument());
  });

  it('shows an error banner when the outage toggle is enabled', async () => {
    installFetchMock(seed);
    render(<App />);
    await waitFor(() => expect(within(getTable()).getByText('SAT-001')).toBeInTheDocument());

    await userEvent.click(screen.getByLabelText(/simulate outage/i));

    const row = within(getTable()).getByText('SAT-001').closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: /delete/i }));
    await userEvent.click(within(row).getByRole('button', { name: /yes, delete/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/unable to reach the telemetry service/i);
  });
});
