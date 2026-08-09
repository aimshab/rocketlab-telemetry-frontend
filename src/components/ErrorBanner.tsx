interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner__icon" aria-hidden="true">
        ⚠
      </span>
      <span className="error-banner__message">{message}</span>
      <span className="error-banner__actions">
        {onRetry && (
          <button type="button" className="button button--ghost" onClick={onRetry}>
            Retry
          </button>
        )}
        {onDismiss && (
          <button type="button" className="button button--ghost" onClick={onDismiss} aria-label="Dismiss error">
            Dismiss
          </button>
        )}
      </span>
    </div>
  );
}
