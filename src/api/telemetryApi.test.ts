import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The facade picks its implementation once, at module load time, based on
 * `VITE_API_MODE`. Each test forces a fresh module evaluation (`resetModules`
 * + a dynamic `import`) after stubbing the env var, so we can exercise both
 * branches of the switch within a single test file.
 */
describe('telemetryApi facade (VITE_API_MODE configuration)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the real (backend) client when VITE_API_MODE is unset', async () => {
    const api = await import('./telemetryApi');
    expect(api.apiMode).toBe('real');
  });

  it('switches to the mock client when VITE_API_MODE=mock', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock');

    const api = await import('./telemetryApi');
    expect(api.apiMode).toBe('mock');

    // The mock client works fully in isolation (no fetch/network involved).
    const entries = await api.getTelemetry();
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('is case-insensitive and falls back to "real" for unrecognized values', async () => {
    vi.stubEnv('VITE_API_MODE', 'MOCK');
    const mockCased = await import('./telemetryApi');
    expect(mockCased.apiMode).toBe('mock');

    vi.resetModules();
    vi.stubEnv('VITE_API_MODE', 'bogus-value');
    const fallback = await import('./telemetryApi');
    expect(fallback.apiMode).toBe('real');
  });

  it('re-exports a working getTelemetry/createTelemetry/deleteTelemetry/ApiError surface', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock');
    const api = await import('./telemetryApi');

    const created = await api.createTelemetry({
      satelliteId: 'SAT-FACADE',
      timestamp: new Date().toISOString(),
      altitude: 600,
      velocity: 7.5,
      status: 'healthy',
    });
    expect(created.satelliteId).toBe('SAT-FACADE');

    await api.deleteTelemetry(created.id);
    const entries = await api.getTelemetry();
    expect(entries.find((e) => e.id === created.id)).toBeUndefined();
  });
});
