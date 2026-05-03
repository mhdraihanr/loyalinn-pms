import { redirect } from "next/navigation";
import {
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { OperationsTabs } from "@/components/operations/operations-tabs";
import type { ArrivalRequest } from "@/components/operations/arrival-requests-table";
import type { HousekeepingRequest } from "@/components/operations/housekeeping-table";
import type { RoomServiceOrder } from "@/components/operations/room-service-table";
import { PageAutoRefresh } from "@/components/layout/page-auto-refresh";
import {
  getArrivalRequests,
  getHousekeepingRequests,
  getRoomServiceOrders,
} from "@/lib/data/operations";
import { getCurrentUserTenant } from "@/lib/auth/tenant";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const userTenant = await getCurrentUserTenant();

  if (!userTenant) redirect("/onboarding");

  const [housekeepingData, roomServiceData, arrivalRequestsData] =
    await Promise.all([
      getHousekeepingRequests(userTenant.tenantId),
      getRoomServiceOrders(userTenant.tenantId),
      getArrivalRequests(userTenant.tenantId),
    ]);

  const housekeepingRequests =
    housekeepingData as unknown as HousekeepingRequest[];
  const roomServiceOrders = roomServiceData as unknown as RoomServiceOrder[];
  const arrivalRequests = arrivalRequestsData as unknown as ArrivalRequest[];

  const summaryItems = [
    {
      label: "Housekeeping pending",
      color: "yellow",
      value: housekeepingRequests.filter(
        (request) => request.status === "pending",
      ).length,
    },
    {
      label: "Room service pending",
      color: "orange",
      value: roomServiceOrders.filter((order) => order.status === "pending")
        .length,
    },
    {
      label: "Arrival requests active",
      color: "cyan",
      value: arrivalRequests.filter((request) =>
        ["pending", "in-progress"].includes(request.status),
      ).length,
    },
    {
      label: "Operational workload",
      color: "blue",
      value:
        housekeepingRequests.length +
        roomServiceOrders.length +
        arrivalRequests.length,
    },
  ];

  return (
    <PageAutoRefresh intervalMs={10_000}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Title order={2}>Operations Dashboard</Title>
            <Text c="dimmed" size="sm">
              Ringkasan antrean operasional hotel untuk housekeeping, room
              service, dan arrival requests.
            </Text>
          </Stack>
        </Group>

        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
          {summaryItems.map((item) => (
            <Card key={item.label} withBorder radius="md" padding="md">
              <Stack gap={4}>
                <Badge
                  color={item.color}
                  variant="light"
                  radius="sm"
                  w="fit-content"
                >
                  {item.label}
                </Badge>
                <Text fw={700} size="xl">
                  {item.value}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Card withBorder radius="md" padding="lg">
          <OperationsTabs
            housekeepingData={housekeepingRequests}
            roomServiceData={roomServiceOrders}
            arrivalRequestsData={arrivalRequests}
          />
        </Card>
      </Stack>
    </PageAutoRefresh>
  );
}
