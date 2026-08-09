import { useEffect, useRef, useState, type FormEvent } from 'react';
import { KNOWN_STATUSES, type NewTelemetryEntry } from '../types';
import { formatTimestampInput, parseTimestampInput, toTimestampInputValue } from '../utils/timestampInput';
import { Spinner } from './Spinner';

interface FormValues {
  satelliteId: string;
  timestamp: string;
  altitude: string;
  velocity: string;
  status: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

function buildInitialValues(): FormValues {
  return {
    satelliteId: '',
    timestamp: toTimestampInputValue(new Date()),
    altitude: '',
    velocity: '',
    status: 'healthy',
  };
}

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.satelliteId.trim()) {
    errors.satelliteId = 'Satellite ID is required.';
  }

  if (!values.timestamp.trim()) {
    errors.timestamp = 'Timestamp is required.';
  } else if (!parseTimestampInput(values.timestamp)) {
    errors.timestamp = 'Use YYYY-MM-DD HH:mm:ss.SSS UTC (a valid date and time).';
  }

  if (values.altitude === '') {
    errors.altitude = 'Altitude is required.';
  } else if (Number.isNaN(Number(values.altitude)) || Number(values.altitude) <= 0) {
    errors.altitude = 'Altitude must be greater than 0.';
  }

  if (values.velocity === '') {
    errors.velocity = 'Velocity is required.';
  } else if (Number.isNaN(Number(values.velocity)) || Number(values.velocity) <= 0) {
    errors.velocity = 'Velocity must be greater than 0.';
  }

  if (!values.status.trim()) {
    errors.status = 'Health status is required.';
  }

  return errors;
}

interface TelemetryFormProps {
  onSubmit: (input: NewTelemetryEntry) => Promise<boolean>;
  isSubmitting: boolean;
  /** Renders a "Cancel" button that calls this instead of submitting, e.g. to collapse the form. */
  onCancel?: () => void;
}

export function TelemetryForm({ onSubmit, isSubmitting, onCancel }: TelemetryFormProps) {
  const [values, setValues] = useState<FormValues>(buildInitialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const satelliteIdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    satelliteIdInputRef.current?.focus();
  }, []);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSubmitSuccess(false);
  }

  function handleTimestampChange(rawValue: string) {
    setField('timestamp', formatTimestampInput(rawValue));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validate(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    // The backend requires strict ISO 8601 (e.g. 2026-08-06T12:00:00.000Z);
    // Date#toISOString() always produces that shape. `validate` already
    // guarantees `parseTimestampInput` succeeds at this point.
    const parsed = parseTimestampInput(values.timestamp) as Date;
    const success = await onSubmit({
      satelliteId: values.satelliteId.trim(),
      timestamp: parsed.toISOString(),
      altitude: Number(values.altitude),
      velocity: Number(values.velocity),
      status: values.status.trim(),
    });

    if (success) {
      setValues(buildInitialValues());
      setErrors({});
      setSubmitSuccess(true);
    }
  }

  return (
    <form className="panel form" onSubmit={handleSubmit} noValidate aria-label="Add telemetry entry">
      <div className="form__header">
        <h2 className="panel__title">Add Telemetry Entry</h2>
        {onCancel && (
          <button
            type="button"
            className="form__close-button"
            onClick={onCancel}
            aria-label="Close add telemetry entry form"
          >
            ×
          </button>
        )}
      </div>

      <div className="form__row">
        <div className="form__field">
          <label htmlFor="field-satellite-id">Satellite ID</label>
          <input
            ref={satelliteIdInputRef}
            id="field-satellite-id"
            type="text"
            placeholder="e.g. SAT-004"
            value={values.satelliteId}
            onChange={(e) => setField('satelliteId', e.target.value)}
            aria-invalid={Boolean(errors.satelliteId)}
            aria-describedby={errors.satelliteId ? 'error-satellite-id' : undefined}
          />
          {errors.satelliteId && (
            <p className="form__error" id="error-satellite-id">
              {errors.satelliteId}
            </p>
          )}
        </div>

        <div className="form__field">
          <label htmlFor="field-timestamp">Timestamp (UTC)</label>
          <input
            id="field-timestamp"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 2026-08-06 12:00:00.000 UTC"
            value={values.timestamp}
            onChange={(e) => handleTimestampChange(e.target.value)}
            aria-invalid={Boolean(errors.timestamp)}
            aria-describedby={errors.timestamp ? 'error-timestamp' : 'hint-timestamp'}
          />
          <p className="form__hint" id="hint-timestamp">
            Enter time in UTC — format: YYYY-MM-DD HH:mm:ss.SSS
          </p>
          {errors.timestamp && (
            <p className="form__error" id="error-timestamp">
              {errors.timestamp}
            </p>
          )}
        </div>

        <div className="form__field">
          <label htmlFor="field-health-status">Health Status</label>
          <select
            id="field-health-status"
            value={values.status}
            onChange={(e) => setField('status', e.target.value)}
          >
            {KNOWN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form__row">
        <div className="form__field">
          <label htmlFor="field-altitude">Altitude (km)</label>
          <input
            id="field-altitude"
            type="number"
            step="0.01"
            className="input--no-spinner"
            placeholder="e.g. 705.20"
            value={values.altitude}
            onChange={(e) => setField('altitude', e.target.value)}
            aria-invalid={Boolean(errors.altitude)}
            aria-describedby={errors.altitude ? 'error-altitude' : undefined}
          />
          {errors.altitude && (
            <p className="form__error" id="error-altitude">
              {errors.altitude}
            </p>
          )}
        </div>

        <div className="form__field">
          <label htmlFor="field-velocity">Velocity (km/s)</label>
          <input
            id="field-velocity"
            type="number"
            step="0.01"
            className="input--no-spinner"
            placeholder="e.g. 7.53"
            value={values.velocity}
            onChange={(e) => setField('velocity', e.target.value)}
            aria-invalid={Boolean(errors.velocity)}
            aria-describedby={errors.velocity ? 'error-velocity' : undefined}
          />
          {errors.velocity && (
            <p className="form__error" id="error-velocity">
              {errors.velocity}
            </p>
          )}
        </div>
      </div>

      <div className="form__footer">
        <button type="submit" className="button button--primary" disabled={isSubmitting}>
          {isSubmitting ? <Spinner label="Adding…" size="sm" /> : 'Add Entry'}
        </button>
        {onCancel && (
          <button type="button" className="button button--ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
        )}
        {submitSuccess && (
          <span className="form__success" role="status">
            Entry added.
          </span>
        )}
      </div>
    </form>
  );
}
