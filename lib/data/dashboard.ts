import { createClient } from "@/lib/supabase/server";
import { wahaClient } from "@/lib/waha/client";

type RecentReservationRow = {
  id: string;
  room_number: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  status: string;
  guests: {
    name: string | null;
  } | null;
};

type StatusRecord = {
  status: string;
};

type WahaStatusResponse = {
  status?: string;
  me?: {
    user?: string;
    id?: string;
  } | null;
};

export type DashboardStats = {
  guests: number;
  activeReservations: number;
  messagesSent: number;
  occupancyRate: number;
};

export type OperationalAttentionSummary = {
  housekeepingPending: number;
  roomServicePending: number;
  arrivalRequestsActive: number;
  totalWorkload: number;
};

export type WahaHealthSummary = {
  status: string;
  connectedNumber: string | null;
  description: string;
  color: string;
  needsAttention: boolean;
};

export function calculateOccupancyRate(
  activeReservations: number,
  totalReservations: number,
) {
  if (totalReservations <= 0) return 0;
  return Math.round((activeReservations / totalReservations) * 100);
}

export function summarizeOperationalAttention(input: {
  housekeeping: StatusRecord[];
  roomService: StatusRecord[];
  arrivalRequests: StatusRecord[];
}): OperationalAttentionSummary {
  return {
    housekeepingPending: input.housekeeping.filter(
      (request) => request.status === "pending",
    ).length,
    roomServicePending: input.roomService.filter(
      (order) => order.status === "pending",
    ).length,
    arrivalRequestsActive: input.arrivalRequests.filter((request) =>
      ["pending", "in-progress"].includes(request.status),
    ).length,
    totalWorkload:
      input.housekeeping.length +
      input.roomService.length +
      input.arrivalRequests.length,
  };
}

export function normalizeWahaHealth(
  data: WahaStatusResponse | null | undefined,
): WahaHealthSummary {
  const status = data?.status ?? "STOPPED";
  const connectedNumber =
    data?.me?.user?.split(":")[0] ?? data?.me?.id?.split("@")[0] ?? null;

  if (status === "WORKING") {
    return {
      status,
      connectedNumber,
      description: "Connected and ready to send automated WhatsApp messages.",
      color: "green",
      needsAttention: false,
    };
  }

  if (status === "SCAN_QR_CODE") {
    return {
      status,
      connectedNumber: null,
      description: "Waiting for QR scan to complete WhatsApp connection.",
      color: "yellow",
      needsAttention: true,
    };
  }

  if (status === "STARTING") {
    return {
      status,
      connectedNumber: null,
      description: "Starting WAHA session and checking WhatsApp connection.",
      color: "blue",
      needsAttention: true,
    };
  }

  if (status === "LOADING") {
    return {
      status,
      connectedNumber: null,
      description: "Checking current WAHA session status.",
      color: "gray",
      needsAttention: false,
    };
  }

  if (status === "ERROR") {
    return {
      status,
      connectedNumber: null,
      description:
        "WAHA server is unreachable or returned an unexpected error.",
      color: "red",
      needsAttention: true,
    };
  }

  return {
    status,
    connectedNumber: null,
    description:
      "WhatsApp is disconnected. Reconnect WAHA to resume automations.",
    color: "red",
    needsAttention: true,
  };
}

export async function getDashboardStats(
  tenantId: string,
): Promise<DashboardStats> {
  const supabase = await createClient();

  const [
    { count: guestCount },
    { count: activeReservationCount },
    { count: totalReservationCount },
    { count: messageCount },
  ] = await Promise.all([
    supabase
      .from("guests")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["pre-arrival", "on-stay"]),
    supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("message_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "sent"),
  ]);

  return {
    guests: guestCount ?? 0,
    activeReservations: activeReservationCount ?? 0,
    messagesSent: messageCount ?? 0,
    occupancyRate: calculateOccupancyRate(
      activeReservationCount ?? 0,
      totalReservationCount ?? 0,
    ),
  };
}

export async function getOperationalAttention(
  tenantId: string,
): Promise<OperationalAttentionSummary> {
  const supabase = await createClient();

  const [housekeepingResult, roomServiceResult, arrivalRequestsResult] =
    await Promise.all([
      supabase
        .from("housekeeping_requests")
        .select("status")
        .eq("tenant_id", tenantId)
        .or(
          `status.in.(pending,in-progress),and(status.eq.completed,updated_at.gte.${new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000,
          ).toISOString()})`,
        ),
      supabase
        .from("room_service_orders")
        .select("status")
        .eq("tenant_id", tenantId)
        .or(
          `status.in.(pending,in-progress),and(status.eq.completed,updated_at.gte.${new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000,
          ).toISOString()})`,
        ),
      supabase
        .from("arrival_requests")
        .select("status")
        .eq("tenant_id", tenantId)
        .or(
          `status.in.(pending,in-progress),and(status.eq.resolved,updated_at.gte.${new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000,
          ).toISOString()})`,
        ),
    ]);

  if (housekeepingResult.error) {
    console.error(
      "Error fetching housekeeping attention summary:",
      housekeepingResult.error,
    );
  }
  if (roomServiceResult.error) {
    console.error(
      "Error fetching room service attention summary:",
      roomServiceResult.error,
    );
  }
  if (arrivalRequestsResult.error) {
    console.error(
      "Error fetching arrival requests attention summary:",
      arrivalRequestsResult.error,
    );
  }

  return summarizeOperationalAttention({
    housekeeping: (housekeepingResult.data as StatusRecord[] | null) ?? [],
    roomService: (roomServiceResult.data as StatusRecord[] | null) ?? [],
    arrivalRequests:
      (arrivalRequestsResult.data as StatusRecord[] | null) ?? [],
  });
}

export async function getWahaHealth(): Promise<WahaHealthSummary> {
  try {
    const sessions = (await wahaClient.getSessions()) as Array<{
      name: string;
      status: string;
      me?: { user?: string; id?: string };
    }>;
    const session = sessions.find((item) => item.name === "default");
    return normalizeWahaHealth(
      session
        ? { status: session.status, me: session.me ?? null }
        : { status: "STOPPED" },
    );
  } catch (error) {
    console.error("Error fetching WAHA health:", error);
    return normalizeWahaHealth({ status: "ERROR" });
  }
}

export async function getRecentReservations(tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id,
      room_number,
      check_in_date,
      check_out_date,
      status,
      guests (
        name
      )
      `,
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("Error fetching recent reservations:", error);
  }

  const formattedData = ((data as RecentReservationRow[] | null) || []).map(
    (r) => ({
      ...r,
      guest_name: r.guests?.name || "Unknown Guest",
    }),
  );

  return formattedData;
}
