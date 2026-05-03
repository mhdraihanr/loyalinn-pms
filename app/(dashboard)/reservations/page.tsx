import { Suspense } from "react";
import {
  Badge,
  Box,
  Card,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { getReservations } from "@/lib/data/reservations";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { ReservationsTable } from "@/components/reservations/reservations-table";
import { ReservationsTabs } from "@/components/reservations/reservations-tabs";
import { PageAutoRefresh } from "@/components/layout/page-auto-refresh";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Reservations | Hotel PMS",
};

type ReservationWithGuest = {
  id: string;
  pms_reservation_id: string | null;
  room_number: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  amount: number | null;
  source: string | null;
  created_at: string;
  guests: {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

function countByStatus(reservations: ReservationWithGuest[], status: string) {
  return reservations.filter((reservation) => reservation.status === status)
    .length;
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const tenantUser = await getCurrentUserTenant();
  if (!tenantUser) redirect("/onboarding");

  const params = await searchParams;
  const currentStatus = params.status || "all";
  const reservations = (await getReservations(
    tenantUser.tenantId,
    currentStatus,
  )) as ReservationWithGuest[];

  const totalReservations = reservations.length;
  const preArrivalCount = countByStatus(reservations, "pre-arrival");
  const onStayCount = countByStatus(reservations, "on-stay");
  const checkedOutCount = countByStatus(reservations, "checked-out");

  const statCards = [
    {
      label: "Reservations overview",
      value: totalReservations.toLocaleString("en-US"),
      color: "blue",
    },
    {
      label: "Pre-arrival",
      value: preArrivalCount.toLocaleString("en-US"),
      color: "violet",
    },
    {
      label: "On-stay",
      value: onStayCount.toLocaleString("en-US"),
      color: "teal",
    },
    {
      label: "Checked out",
      value: checkedOutCount.toLocaleString("en-US"),
      color: "gray",
    },
  ];

  return (
    <PageAutoRefresh intervalMs={10_000}>
      <Stack gap="xl">
        <Box>
          <Title order={2}>Reservations</Title>
          <Text c="dimmed" size="sm">
            Reservations overview for upcoming arrivals, active stays, and
            completed check-outs.
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing="md">
          {statCards.map((stat) => (
            <Card key={stat.label} withBorder radius="md" padding="md">
              <Stack gap={4}>
                <Badge
                  color={stat.color}
                  variant="light"
                  radius="sm"
                  w="fit-content"
                >
                  {stat.label}
                </Badge>
                <Text fw={700} size="xl">
                  {stat.value}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Card radius="md" p="md" withBorder shadow="sm">
          <Stack gap="md">
            <ReservationsTabs currentStatus={currentStatus} />

            <Suspense fallback={<Skeleton height={400} radius="md" />}>
              <ReservationsTable reservations={reservations} />
            </Suspense>
          </Stack>
        </Card>
      </Stack>
    </PageAutoRefresh>
  );
}
