import { Alert, Container, Stack, Text, Title } from "@mantine/core";

import { PostStayFeedbackForm } from "@/components/feedback/post-stay-feedback-form";
import { verifyFeedbackToken } from "@/lib/automation/feedback-link";
import { createAdminClient } from "@/lib/supabase/admin";

type FeedbackPageProps = {
  params: Promise<{
    token: string;
  }>;
};

function getRelationName(value: unknown, fallback: string) {
  if (!value) {
    return fallback;
  }

  if (Array.isArray(value)) {
    const first = value[0] as { name?: string } | undefined;
    return first?.name ?? fallback;
  }

  return (value as { name?: string }).name ?? fallback;
}

export default async function FeedbackPage({ params }: FeedbackPageProps) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  const payload = verifyFeedbackToken(token);
  if (!payload) {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" title="Link tidak valid atau kedaluwarsa">
          Silakan hubungi hotel untuk meminta link feedback baru.
        </Alert>
      </Container>
    );
  }

  const adminClient = createAdminClient();
  const { data: reservation, error } = await adminClient
    .from("reservations")
    .select(
      "id, post_stay_feedback_status, post_stay_rating, guests(name), tenants(name)",
    )
    .eq("id", payload.reservationId)
    .eq("tenant_id", payload.tenantId)
    .maybeSingle();

  if (error || !reservation) {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" title="Reservasi tidak ditemukan">
          Data feedback tidak dapat diproses untuk link ini.
        </Alert>
      </Container>
    );
  }

  const guestName = getRelationName(reservation.guests, "Guest");
  const hotelName = getRelationName(reservation.tenants, "Hotel");

  if (reservation.post_stay_feedback_status === "completed") {
    return (
      <Container size="sm" py="xl">
        <Stack gap="md">
          <Title order={2}>Feedback sudah diterima</Title>
          <Text c="dimmed">
            Terima kasih, {guestName}. Feedback Anda untuk {hotelName} sudah
            tersimpan.
          </Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="sm" py="xl">
      <PostStayFeedbackForm
        token={token}
        guestName={guestName}
        hotelName={hotelName}
      />
    </Container>
  );
}
