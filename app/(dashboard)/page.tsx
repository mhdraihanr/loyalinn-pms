import { redirect } from "next/navigation";
import {
  ActionIcon,
  Badge,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBed,
  IconBuilding,
  IconCalendarCheck,
  IconChecklist,
  IconMessage,
  IconQrcode,
  IconToolsKitchen2,
  IconUsers,
  IconBrandWhatsapp,
} from "@tabler/icons-react";
import Link from "next/link";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import {
  getDashboardStats,
  getOperationalAttention,
  getRecentReservations,
  getWahaHealth,
} from "@/lib/data/dashboard";
import { RecentReservationsTable } from "@/components/dashboard/recent-reservations";

export default async function DashboardPage() {
  const userTenant = await getCurrentUserTenant();

  if (!userTenant) redirect("/onboarding");

  const tenantId = userTenant.tenantId;
  const [stats, operationalAttention, wahaHealth, reservations] =
    await Promise.all([
      getDashboardStats(tenantId),
      getOperationalAttention(tenantId),
      getWahaHealth(),
      getRecentReservations(tenantId),
    ]);

  const statCards = [
    {
      label: "Total Guests",
      value: stats.guests,
      helper: "Total guest profiles synced to your tenant",
      icon: IconUsers,
      color: "blue",
    },
    {
      label: "Active Reservations",
      value: stats.activeReservations,
      helper: "Pre-arrival and on-stay guests in progress",
      icon: IconCalendarCheck,
      color: "green",
    },
    {
      label: "Messages Sent",
      value: stats.messagesSent,
      helper: "Successful WhatsApp automations delivered",
      icon: IconMessage,
      color: "violet",
    },
    {
      label: "Occupancy Rate",
      value: `${stats.occupancyRate}%`,
      helper: "Active stays compared to all reservations",
      icon: IconBuilding,
      color: "teal",
    },
  ];

  const operationalItems = [
    {
      label: "Housekeeping pending",
      value: operationalAttention.housekeepingPending,
      icon: IconBed,
      color: "yellow",
    },
    {
      label: "Room service pending",
      value: operationalAttention.roomServicePending,
      icon: IconToolsKitchen2,
      color: "orange",
    },
    {
      label: "Arrival requests active",
      value: operationalAttention.arrivalRequestsActive,
      icon: IconChecklist,
      color: "cyan",
    },
  ];

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed" size="sm">
            Control tower for guest activity, operational workload, and WhatsApp
            connectivity.
          </Text>
        </Stack>
        <Badge
          color={wahaHealth.needsAttention ? "yellow" : "green"}
          variant="light"
          radius="sm"
          leftSection={<IconBrandWhatsapp size={14} />}
        >
          WAHA {wahaHealth.needsAttention ? "needs attention" : "healthy"}
        </Badge>
      </Group>

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
                <Text size="xs" c="dimmed">
                  {stat.helper}
                </Text>
              </Stack>
              <ThemeIcon
                size={42}
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

      <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md">
        <Card
          withBorder
          radius="md"
          padding="lg"
          style={{ gridColumn: "span 2" }}
        >
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Title order={4}>Operational Attention</Title>
                <Text size="sm" c="dimmed">
                  Fast view of open workload across housekeeping, room service,
                  and arrival requests.
                </Text>
              </Stack>
              <Group gap="xs">
                <Badge color="blue" variant="light">
                  Total workload {operationalAttention.totalWorkload}
                </Badge>
                <Link href="/operations" aria-label="Open operations dashboard">
                  <ActionIcon variant="light" color="gray">
                    <IconArrowRight size={16} />
                  </ActionIcon>
                </Link>
              </Group>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              {operationalItems.map((item) => (
                <Card key={item.label} radius="md" padding="md" bg="gray.0">
                  <Stack gap={8}>
                    <ThemeIcon
                      color={item.color}
                      variant="light"
                      radius="md"
                      size={36}
                    >
                      <item.icon size={18} />
                    </ThemeIcon>
                    <Text size="sm" c="dimmed">
                      {item.label}
                    </Text>
                    <Text fw={700} size="xl">
                      {item.value}
                    </Text>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Title order={4}>WhatsApp Health</Title>
                <Text size="sm" c="dimmed">
                  WAHA connection status for outbound guest automations.
                </Text>
              </Stack>
              <ThemeIcon
                color={wahaHealth.color}
                variant="light"
                radius="md"
                size={40}
              >
                {wahaHealth.status === "SCAN_QR_CODE" ? (
                  <IconQrcode size={20} />
                ) : wahaHealth.needsAttention ? (
                  <IconAlertTriangle size={20} />
                ) : (
                  <IconBrandWhatsapp size={20} />
                )}
              </ThemeIcon>
            </Group>

            <Badge
              color={wahaHealth.color}
              variant="light"
              radius="sm"
              w="fit-content"
            >
              {wahaHealth.status}
            </Badge>

            <Text size="sm" c="dimmed">
              {wahaHealth.description}
            </Text>

            <Divider />

            <Stack gap={6}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Connected number
              </Text>
              <Text fw={600}>
                {wahaHealth.connectedNumber
                  ? `+${wahaHealth.connectedNumber}`
                  : "Not connected"}
              </Text>
            </Stack>

            <Link href="/settings/waha" aria-label="Open WhatsApp settings">
              <ActionIcon variant="light" color="gray" size="lg">
                <IconArrowRight size={16} />
              </ActionIcon>
            </Link>
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="md" padding="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Title order={4}>Recent Reservations</Title>
              <Text size="sm" c="dimmed">
                Latest reservation activity available to operations and guest
                messaging flows.
              </Text>
            </Stack>
            <Text size="xs" c="dimmed" ta="right">
              Includes guest, room, stay dates, and reservation status.
            </Text>
          </Group>
          <RecentReservationsTable reservations={reservations} />
        </Stack>
      </Card>
    </Stack>
  );
}
