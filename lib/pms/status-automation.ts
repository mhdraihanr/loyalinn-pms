export type ReservationStatus =
  | "pre-arrival"
  | "on-stay"
  | "checked-out"
  | "cancelled";

export type StatusAutomationTrigger = "on-stay" | "post-stay" | "cancelled";

export function resolveStatusAutomationTrigger(params: {
  previousStatus?: string;
  nextStatus: string;
  statusChanged: boolean;
}): StatusAutomationTrigger | null {
  if (!params.statusChanged || !params.previousStatus) {
    return null;
  }

  if (params.nextStatus === "on-stay") {
    return "on-stay";
  }

  if (params.nextStatus === "checked-out") {
    return "post-stay";
  }

  if (params.nextStatus === "cancelled") {
    return "cancelled";
  }

  return null;
}
