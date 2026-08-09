interface SpinnerProps {
  label?: string;
  size?: 'sm' | 'md';
}

export function Spinner({ label = 'Loading…', size = 'md' }: SpinnerProps) {
  return (
    <span className={`spinner-wrap spinner-wrap--${size}`} role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="spinner-label">{label}</span>
    </span>
  );
}
