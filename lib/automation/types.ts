export type IdempotencyKeyInput = {
  bookingId: string;
  status: string;
  updatedAt?: string;
  rawPayload?: string;
};

export type NormalizedPmsWebhookEvent = {
  bookingId: string;
  status: string;
  updatedAt?: string;
  rawPayload: string;
};
