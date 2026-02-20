import { redirect } from "next/navigation";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { getDashboardStats, getRecentReservations } from "@/lib/data/dashboard";
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

const statusColors: Record<string, string> = {
  confirmed: "blue",
  checked_in: "green",
  checked_out: "gray",
  cancelled: "red",
  no_show: "orange",
};

export default async function DashboardPage() {
  const userTenant = await getCurrentUserTenant();

  if (!userTenant) redirect("/onboarding");

  const tenantId = userTenant.tenantId;
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
