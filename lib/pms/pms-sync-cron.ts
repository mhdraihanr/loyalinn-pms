import { runAutoSyncForTenant } from "@/lib/pms/auto-sync-service";
import { getPMSAdapter } from "@/lib/pms/registry";
import { createAdminClient } from "@/lib/supabase/admin";

type ActivePmsConfiguration = {
  tenant_id: string;
  pms_type: string;
  endpoint: string;
  credentials: Record<string, string>;
};

export type PmsSyncCronResult = {
  tenantsProcessed: number;
  tenantsFailed: number;
  reservationsSynced: number;
  eventsCreated: number;
  jobsEnqueued: number;
};

function buildSyncWindow(baseTime = new Date()) {
  const startDate = new Date(baseTime);
  // Hanya tarik data dari maksimal 3 hari ke belakang (bukan 30 hari).
  // Dengan ini, reservasi lama/terselesaikan (checked-out/cancelled) yang Anda hapus
  // di tabel lokal tidak akan ditarik ulang oleh aplikasi (*keep web clean*).
  startDate.setDate(baseTime.getDate() - 3);

  const endDate = new Date(baseTime);
  endDate.setDate(baseTime.getDate() + 60);

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

export async function runPmsSyncCron(
  baseTime = new Date(),
): Promise<PmsSyncCronResult> {
  const adminClient = createAdminClient();
  const { data: configurations, error } = await adminClient
    .from("pms_configurations")
    .select("tenant_id, pms_type, endpoint, credentials")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const window = buildSyncWindow(baseTime);
  const result: PmsSyncCronResult = {
    tenantsProcessed: 0,
    tenantsFailed: 0,
    reservationsSynced: 0,
    eventsCreated: 0,
    jobsEnqueued: 0,
  };

  for (const configuration of (configurations ??
    []) as ActivePmsConfiguration[]) {
    try {
      const adapter = getPMSAdapter(configuration.pms_type);
      adapter.init(configuration.credentials, configuration.endpoint);

      const syncResult = await runAutoSyncForTenant({
        tenantId: configuration.tenant_id,
        adapter,
        startDate: window.startDate,
        endDate: window.endDate,
      });

      result.tenantsProcessed += 1;
      result.reservationsSynced += syncResult.reservationsSynced;
      result.eventsCreated += syncResult.eventsCreated;
      result.jobsEnqueued += syncResult.jobsEnqueued;
    } catch {
      result.tenantsFailed += 1;
    }
  }

  return result;
}
