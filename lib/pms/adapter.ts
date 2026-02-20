export type AdapterGuest = {
  pms_guest_id: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
};

export type AdapterReservation = {
  pms_reservation_id: string;
  pms_guest_id: string;
  room_number?: string;
  check_in_date: string;
  check_out_date: string;
  pms_status: string;
  amount?: number;
  source?: string;
};

export interface PMSAdapter {
  /**
   * Initializes the adapter with tenant-specific credentials
   */
  init(credentials: Record<string, string>, endpoint: string): void;

  /**
   * Pulls reservations for a specific date range
   */
  pullReservations(
    startDate: string,
    endDate: string,
  ): Promise<AdapterReservation[]>;

  /**
   * Pulls guest details for a specific guest ID
   */
  pullGuest(pmsGuestId: string): Promise<AdapterGuest | null>;

  /**
   * Maps a PMS-specific status string to an internal system status
   * Allowed internal statuses: 'pre-arrival', 'on-stay', 'checked-out', 'cancelled'
   */
  mapStatus(
    pmsStatus: string,
  ): "pre-arrival" | "on-stay" | "checked-out" | "cancelled";
}
