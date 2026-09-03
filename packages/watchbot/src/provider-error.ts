/**
 * Structured retryability for WatchBot provider failures.
 *
 * Prefer an explicit `retryable` flag on typed provider errors
 * (YouTube, X, OpenAI web). Known OpenAI web / Grok code strings are a
 * fallback for adapters that still throw those codes as plain Errors.
 * Arbitrary external messages are not classified as retryable.
 */

export function isRetryableProviderError(error: unknown): boolean {
  if (hasRetryableFlag(error)) {
    return error.retryable === true;
  }
  if (error instanceof Error) {
    return isRetryableKnownProviderCode(error.message);
  }
  return false;
}

export function sanitizeProviderErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 300);
  }
  return "WatchBot error";
}

function hasRetryableFlag(error: unknown): error is { retryable: boolean } {
  return (
    typeof error === "object" &&
    error !== null &&
    "retryable" in error &&
    typeof (error as { retryable: unknown }).retryable === "boolean"
  );
}

function isRetryableKnownProviderCode(message: string): boolean {
  if (
    message === "openai_web_timeout" ||
    message === "openai_web_network"
  ) {
    return true;
  }
  const http = /^(?:openai_web_http_|grok_http_)(\d+)$/.exec(message);
  if (!http) {
    return false;
  }
  const status = Number(http[1]);
  return status === 429 || (status >= 500 && status <= 599);
}
