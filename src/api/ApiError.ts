/** Shared error type thrown by both the mock and real telemetry API clients. */
export class ApiError extends Error {
  readonly status?: number;
  readonly details?: string[];

  constructor(message: string, status?: number, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}
