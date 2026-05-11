import { NextResponse } from "next/server";

import { runPmsReconciliation } from "@/lib/pms/pms-sync-cron";

export const dynamic = "force-dynamic";

function isReconciliationEnabled() {
  return (
    process.env.PMS_RECONCILIATION_ENABLED?.trim().toLowerCase() === "true"
  );
}

function isAuthorized(request: Request) {
  const secret =
    process.env.PMS_RECONCILIATION_CRON_SECRET || process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  return Boolean(secret) && authorization === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isReconciliationEnabled()) {
    return NextResponse.json({
      skipped: true,
      reason: "PMS reconciliation disabled",
    });
  }

  try {
    const result = await runPmsReconciliation(new Date());

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
