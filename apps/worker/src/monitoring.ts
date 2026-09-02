import * as Sentry from "@sentry/node";

export type WorkerMonitoring = {
  capture(error: unknown, operation: string): void;
  flush(): Promise<void>;
};

const FLUSH_TIMEOUT_MS = 2_000;

export function createWorkerMonitoring(
  env: NodeJS.ProcessEnv = process.env,
): WorkerMonitoring {
  const dsn = env.SENTRY_DSN?.trim();
  const enabled = Boolean(dsn);

  if (enabled) {
    Sentry.init({
      dsn,
      enabled: true,
      environment: env.RAILWAY_ENVIRONMENT_NAME ?? env.NODE_ENV,
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
  }

  return {
    capture(error, operation) {
      if (!enabled) return;
      Sentry.withScope((scope) => {
        scope.setTag("openbento.operation", operation);
        Sentry.captureException(error);
      });
    },
    async flush() {
      if (enabled) await Sentry.flush(FLUSH_TIMEOUT_MS);
    },
  };
}
