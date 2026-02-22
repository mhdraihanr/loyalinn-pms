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
  ThemeIcon,
} from "@mantine/core";
import {
  IconUsers,
  IconCalendarCheck,
  IconMessage,
  IconBuilding,
} from "@tabler/icons-react";
import { RecentReservationsTable } from "@/components/dashboard/recent-reservations";

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
      icon: IconBuilding,
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
        <RecentReservationsTable reservations={reservations} />
      </Card>
    </Stack>
  );
}
