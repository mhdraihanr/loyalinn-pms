export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startDevelopmentPmsSyncScheduler } =
    await import("./lib/pms/dev-sync-scheduler");
  const { startDevelopmentAutomationScheduler } =
    await import("./lib/automation/dev-automation-scheduler");

  startDevelopmentPmsSyncScheduler();
  startDevelopmentAutomationScheduler();
}
