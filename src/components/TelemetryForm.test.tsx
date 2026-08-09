import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TelemetryForm } from './TelemetryForm';

describe('TelemetryForm', () => {
  it('shows validation errors and does not submit when fields are empty', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<TelemetryForm onSubmit={onSubmit} isSubmitting={false} />);

    await userEvent.click(screen.getByRole('button', { name: /add entry/i }));

    expect(await screen.findByText(/satellite id is required/i)).toBeInTheDocument();
    expect(screen.getByText(/altitude is required/i)).toBeInTheDocument();
    expect(screen.getByText(/velocity is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects zero or negative numeric values (backend requires > 0)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<TelemetryForm onSubmit={onSubmit} isSubmitting={false} />);

    await userEvent.type(screen.getByLabelText(/satellite id/i), 'SAT-009');
    await userEvent.type(screen.getByLabelText(/altitude/i), '-5');
    await userEvent.type(screen.getByLabelText(/velocity/i), '0');
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }));

    expect(await screen.findByText(/altitude must be greater than 0/i)).toBeInTheDocument();
    expect(screen.getByText(/velocity must be greater than 0/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('formats the timestamp as digits are typed and rejects incomplete values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const user = userEvent.setup();
    render(<TelemetryForm onSubmit={onSubmit} isSubmitting={false} />);

    const timestamp = screen.getByLabelText(/timestamp/i);
    await user.clear(timestamp);
    await user.type(timestamp, '202608061230');

    expect(timestamp).toHaveValue('2026-08-06 12:30');

    await user.type(screen.getByLabelText(/satellite id/i), 'SAT-009');
    await user.type(screen.getByLabelText(/altitude/i), '600');
    await user.type(screen.getByLabelText(/velocity/i), '7.5');
    await user.click(screen.getByRole('button', { name: /add entry/i }));

    expect(await screen.findByText(/use YYYY-MM-DD HH:mm:ss\.SSS UTC/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid data and resets the form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<TelemetryForm onSubmit={onSubmit} isSubmitting={false} />);

    await userEvent.type(screen.getByLabelText(/satellite id/i), 'SAT-009');
    await userEvent.type(screen.getByLabelText(/altitude/i), '600');
    await userEvent.type(screen.getByLabelText(/velocity/i), '7.5');
    await userEvent.selectOptions(screen.getByLabelText(/health status/i), 'warning');
    await userEvent.click(screen.getByRole('button', { name: /add entry/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.satelliteId).toBe('SAT-009');
    expect(submitted.altitude).toBe(600);
    expect(submitted.velocity).toBe(7.5);
    expect(submitted.status).toBe('warning');
    expect(typeof submitted.timestamp).toBe('string');

    expect(await screen.findByText(/entry added/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/satellite id/i)).toHaveValue('');
  });

  it('disables the submit button and shows a spinner while submitting', () => {
    render(<TelemetryForm onSubmit={vi.fn()} isSubmitting />);
    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();
  });

  it('does not render Cancel/Close controls when onCancel is not provided', () => {
    render(<TelemetryForm onSubmit={vi.fn()} isSubmitting={false} />);
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close add telemetry entry form/i })).not.toBeInTheDocument();
  });

  it('calls onCancel from both the Cancel button and the close (×) button', async () => {
    const onCancel = vi.fn();
    render(<TelemetryForm onSubmit={vi.fn()} isSubmitting={false} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /close add telemetry entry form/i }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
