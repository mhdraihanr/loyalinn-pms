import { runPmsSyncCron } from "@/lib/pms/pms-sync-cron";

const DEFAULT_INTERVAL_MS = 10 * 1000;

type SchedulerLogger = Pick<Console, "info" | "warn" | "error">;

type SchedulerEnvironment = {
  nodeEnv?: string;
  nextRuntime?: string;
  intervalMs?: string;
};

type DevelopmentPmsSyncSchedulerState = {
  intervalId: ReturnType<typeof setInterval>;
  intervalMs: number;
  isRunning: boolean;
  overlapWarningLogged: boolean;
  stop: () => void;
};

type StartDevelopmentPmsSyncSchedulerOptions = {
  runSync?: () => Promise<unknown>;
  intervalMs?: number;
  environment?: SchedulerEnvironment;
  logger?: SchedulerLogger;
};

type StartDevelopmentPmsSyncSchedulerResult = {
  started: boolean;
  intervalMs: number;
  stop: () => void;
};

declare global {
  var __developmentPmsSyncScheduler:
    | DevelopmentPmsSyncSchedulerState
    | undefined;
}

function resolveIntervalMs(options: {
  intervalMs?: number;
  environment?: SchedulerEnvironment;
}) {
  if (typeof options.intervalMs === "number" && options.intervalMs > 0) {
    return options.intervalMs;
  }

  const rawInterval = options.environment?.intervalMs;

  if (!rawInterval) {
    return DEFAULT_INTERVAL_MS;
  }

  const parsedInterval = Number.parseInt(rawInterval, 10);

  return Number.isFinite(parsedInterval) && parsedInterval > 0
    ? parsedInterval
    : DEFAULT_INTERVAL_MS;
}

function shouldStartScheduler(environment?: SchedulerEnvironment) {
  const nodeEnv = environment?.nodeEnv ?? process.env.NODE_ENV;
  const nextRuntime = environment?.nextRuntime ?? process.env.NEXT_RUNTIME;

  return nodeEnv === "development" && nextRuntime === "nodejs";
}

async function executeSync(options: {
  runSync: () => Promise<unknown>;
  logger: SchedulerLogger;
  state: DevelopmentPmsSyncSchedulerState;
}) {
  if (options.state.isRunning) {
    if (!options.state.overlapWarningLogged) {
      options.logger.warn(
        "Skipping development PMS sync tick because the previous run is still in progress.",
      );
      options.state.overlapWarningLogged = true;
    }

    return;
  }

  options.state.isRunning = true;
  options.state.overlapWarningLogged = false;

  try {
    await options.runSync();
  } catch (error) {
    options.logger.error("Development PMS sync tick failed.", error);
  } finally {
    options.state.isRunning = false;
  }
}

export function startDevelopmentPmsSyncScheduler(
  options: StartDevelopmentPmsSyncSchedulerOptions = {},
): StartDevelopmentPmsSyncSchedulerResult {
  const logger = options.logger ?? console;
  const environment: SchedulerEnvironment = {
    nodeEnv: options.environment?.nodeEnv ?? process.env.NODE_ENV,
    nextRuntime: options.environment?.nextRuntime ?? process.env.NEXT_RUNTIME,
    intervalMs:
      options.environment?.intervalMs ?? process.env.DEV_PMS_SYNC_INTERVAL_MS,
  };
  const intervalMs = resolveIntervalMs({
    intervalMs: options.intervalMs,
    environment,
  });

  if (!shouldStartScheduler(environment)) {
    return {
      started: false,
      intervalMs,
      stop: () => undefined,
    };
  }

  if (globalThis.__developmentPmsSyncScheduler) {
    return {
      started: false,
      intervalMs: globalThis.__developmentPmsSyncScheduler.intervalMs,
      stop: globalThis.__developmentPmsSyncScheduler.stop,
    };
  }

  const runSync = options.runSync ?? (() => runPmsSyncCron());

  const state: DevelopmentPmsSyncSchedulerState = {
    intervalId: setInterval(() => {
      void executeSync({ runSync, logger, state });
    }, intervalMs),
    intervalMs,
    isRunning: false,
    overlapWarningLogged: false,
    stop: () => {
      clearInterval(state.intervalId);
      globalThis.__developmentPmsSyncScheduler = undefined;
    },
  };

  globalThis.__developmentPmsSyncScheduler = state;

  logger.info(
    `Development PMS sync scheduler started with interval ${intervalMs}ms.`,
  );

  void executeSync({ runSync, logger, state });

  return {
    started: true,
    intervalMs,
    stop: state.stop,
  };
}

export function resetDevelopmentPmsSyncSchedulerForTests() {
  globalThis.__developmentPmsSyncScheduler?.stop();
}
