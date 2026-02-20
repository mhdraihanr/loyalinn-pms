import { Suspense } from "react";
import { Title, Text, Group, Paper, Box, Skeleton } from "@mantine/core";
import { getReservations } from "@/lib/data/reservations";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { ReservationsTable } from "@/components/reservations/reservations-table";
import { ReservationsTabs } from "@/components/reservations/reservations-tabs";
import { SyncButton } from "@/components/reservations/sync-button";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Reservations | Hotel PMS",
};

async function ReservationsContent({
  tenantId,
  status,
}: {
  tenantId: string;
  status: string;
}) {
  const reservations = await getReservations(tenantId, status);
  return <ReservationsTable reservations={reservations} />;
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const tenantUser = await getCurrentUserTenant();
  if (!tenantUser) redirect("/onboarding");

  // Next.js 15: searchParams is a Promise
  const params = await searchParams;
  const currentStatus = params.status || "all";

  return (
    <Box>
      <Group justify="space-between" align="flex-start" mb="lg">
        <div>
          <Title order={2}>Reservations</Title>
          <Text c="dimmed" size="sm">
            View and manage your hotel reservations
          </Text>
        </div>
        <SyncButton />
      </Group>

      <Paper radius="md" p="md" withBorder shadow="sm">
        <ReservationsTabs currentStatus={currentStatus} />

        <Suspense fallback={<Skeleton height={400} radius="md" />}>
          <ReservationsContent
            tenantId={tenantUser.tenantId}
            status={currentStatus}
          />
        </Suspense>
      </Paper>
    </Box>
  );
}
