import { PMSAdapter } from "./adapter";
import { MockAdapter } from "./mock-adapter";
import { QloAppsAdapter } from "./qloapps-adapter";

const adapters: Record<string, new () => PMSAdapter> = {
  custom: MockAdapter,
  qloapps: QloAppsAdapter,
  // Add new PMS adapters here as they are built
};

export function getPMSAdapter(pmsType: string): PMSAdapter {
  const AdapterClass = adapters[pmsType];

  if (!AdapterClass) {
    console.warn(
      `[Registry] Adapter for pmsType '${pmsType}' not found in registry. Falling back to MockAdapter.`,
    );
    return new MockAdapter();
  }

  return new AdapterClass();
}
