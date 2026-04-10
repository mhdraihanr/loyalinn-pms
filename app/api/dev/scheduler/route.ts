import { NextResponse } from "next/server";
import { enqueueScheduledAutomationJobs } from "@/lib/automation/scheduler";
import { runAutomationCron } from "@/lib/automation/automation-cron";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Access Denied. Development only." },
      { status: 403 },
    );
  }

  try {
    const { simulatedDateIso } = await request.json();

    if (!simulatedDateIso) {
      return NextResponse.json(
        { error: "Missing simulatedDateIso parameter" },
        { status: 400 },
      );
    }

    const testTime = new Date(simulatedDateIso);
    if (isNaN(testTime.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 },
      );
    }

    // Eksekusi trigger cron runner menggunakan fake time biar job baru langsung dientri dan diproses
    const processingResult = await runAutomationCron(testTime, {
      forceSchedule: true,
    });

    return NextResponse.json({
      preArrivalEnqueued: processingResult.preArrivalEnqueued,
      postStayEnqueued: processingResult.postStayEnqueued,
      processed: processingResult.processed,
      deadLettered: processingResult.deadLettered,
      success: true,
      simulatedTime: testTime.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Simulation Failed",
      },
      { status: 500 },
    );
  }
}
