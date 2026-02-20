import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SimpleGrid,
  Card,
  Text,
  Title,
  Stack,
  Group,
  Badge,
  Table,
  Box,
  ThemeIcon,
} from "@mantine/core";
import {
  IconUsers,
  IconCalendarCheck,
  IconMessage,
  IconBuildingSkyscraper,
} from "@tabler/icons-react";

async function getDashboardStats(tenantId: string) {
  const supabase = await createClient();

  const [
    { count: guestCount },
    { count: reservationCount },
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
      .in("status", ["confirmed", "checked_in"]),
    supabase
      .from("message_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "sent"),
  ]);

  return {
    guests: guestCount ?? 0,
    activeReservations: reservationCount ?? 0,
    messagesSent: messageCount ?? 0,
  };
}

async function getRecentReservations(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservations")
    .select(
      "id, guest_name, room_number, check_in_date, check_out_date, status",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

const statusColors: Record<string, string> = {
  confirmed: "blue",
  checked_in: "green",
  checked_out: "gray",
  cancelled: "red",
  no_show: "orange",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: tenantUser } = await admin
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!tenantUser) redirect("/onboarding");

  const tenantId = tenantUser.tenant_id;
  const [stats, reservations] = await Promise.all([
    getDashboardStats(tenantId),
    getRecentReservations(tenantId),
  ]);

  const statCards = [
    {
      label: "Total Guests",
      value: stats.guests,
      icon: IconUsers,
      color: "blue",
    },
    {
      label: "Active Reservations",
      value: stats.activeReservations,
      icon: IconCalendarCheck,
      color: "green",
    },
    {
      label: "Messages Sent",
      value: stats.messagesSent,
      icon: IconMessage,
      color: "violet",
    },
    {
      label: "Tenant",
      value: "Active",
      icon: IconBuildingSkyscraper,
      color: "teal",
    },
  ];

  return (
    <Stack gap="xl">
      <Title order={2}>Dashboard</Title>

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {statCards.map((stat) => (
          <Card key={stat.label} withBorder radius="md" padding="lg">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {stat.label}
                </Text>
                <Text fw={700} size="xl">
                  {stat.value}
                </Text>
              </Stack>
              <ThemeIcon
                size={40}
                radius="md"
                variant="light"
                color={stat.color}
              >
                <stat.icon size={22} />
              </ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      {/* Recent Reservations */}
      <Card withBorder radius="md" padding="lg">
        <Title order={4} mb="md">
          Recent Reservations
        </Title>
        {reservations.length === 0 ? (
          <Box py="xl" ta="center">
            <Text c="dimmed" size="sm">
              No reservations yet. Connect a PMS to start syncing data.
            </Text>
          </Box>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Guest</Table.Th>
                <Table.Th>Room</Table.Th>
                <Table.Th>Check-in</Table.Th>
                <Table.Th>Check-out</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {reservations.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>{r.guest_name ?? "—"}</Table.Td>
                  <Table.Td>{r.room_number ?? "—"}</Table.Td>
                  <Table.Td>{r.check_in_date ?? "—"}</Table.Td>
                  <Table.Td>{r.check_out_date ?? "—"}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={statusColors[r.status] ?? "gray"}
                      radius="sm"
                      variant="light"
                    >
                      {r.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
