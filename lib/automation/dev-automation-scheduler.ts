import { runAutomationCron } from "@/lib/automation/automation-cron";

const DEFAULT_INTERVAL_MS = 10 * 1000;

type SchedulerLogger = Pick<Console, "info" | "warn" | "error">;

type SchedulerEnvironment = {
  nodeEnv?: string;
  nextRuntime?: string;
  intervalMs?: string;
};

type DevelopmentAutomationSchedulerState = {
  intervalId: ReturnType<typeof setInterval>;
  intervalMs: number;
  isRunning: boolean;
  stop: () => void;
};

type StartDevelopmentAutomationSchedulerOptions = {
  runWorker?: () => Promise<unknown>;
  intervalMs?: number;
  environment?: SchedulerEnvironment;
  logger?: SchedulerLogger;
};

type StartDevelopmentAutomationSchedulerResult = {
  started: boolean;
  intervalMs: number;
  stop: () => void;
};

declare global {
  var __developmentAutomationScheduler:
    | DevelopmentAutomationSchedulerState
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

async function executeWorker(options: {
  runWorker: () => Promise<unknown>;
  logger: SchedulerLogger;
  state: DevelopmentAutomationSchedulerState;
}) {
  if (options.state.isRunning) {
    options.logger.warn(
      "Skipping development automation tick because the previous run is still in progress.",
    );
    return;
  }

  options.state.isRunning = true;

  try {
    await options.runWorker();
  } catch (error) {
    options.logger.error("Development automation tick failed.", error);
  } finally {
    options.state.isRunning = false;
  }
}

export function startDevelopmentAutomationScheduler(
  options: StartDevelopmentAutomationSchedulerOptions = {},
): StartDevelopmentAutomationSchedulerResult {
  const logger = options.logger ?? console;
  const environment: SchedulerEnvironment = {
    nodeEnv: options.environment?.nodeEnv ?? process.env.NODE_ENV,
    nextRuntime: options.environment?.nextRuntime ?? process.env.NEXT_RUNTIME,
    intervalMs:
      options.environment?.intervalMs ??
      process.env.DEV_AUTOMATION_SYNC_INTERVAL_MS,
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

  if (globalThis.__developmentAutomationScheduler) {
    return {
      started: false,
      intervalMs: globalThis.__developmentAutomationScheduler.intervalMs,
      stop: globalThis.__developmentAutomationScheduler.stop,
    };
  }

  const runWorker = options.runWorker ?? (() => runAutomationCron());

  const state: DevelopmentAutomationSchedulerState = {
    intervalId: setInterval(() => {
      void executeWorker({ runWorker, logger, state });
    }, intervalMs),
    intervalMs,
    isRunning: false,
    stop: () => {
      clearInterval(state.intervalId);
      globalThis.__developmentAutomationScheduler = undefined;
    },
  };

  globalThis.__developmentAutomationScheduler = state;

  logger.info(
    `Development automation scheduler started with interval ${intervalMs}ms.`,
  );

  void executeWorker({ runWorker, logger, state });

  return {
    started: true,
    intervalMs,
    stop: state.stop,
  };
}

export function resetDevelopmentAutomationSchedulerForTests() {
  globalThis.__developmentAutomationScheduler?.stop();
}
