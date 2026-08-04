import { redirect } from "next/navigation";
import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import type { ArrivalRequest } from "@/components/operations/arrival-requests-table";
import type { HousekeepingRequest } from "@/components/operations/housekeeping-table";
import { OperationsTabs } from "@/components/operations/operations-tabs";
import type { RoomServiceOrder } from "@/components/operations/room-service-table";
import { PageAutoRefresh } from "@/components/layout/page-auto-refresh";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import {
  getArrivalRequests,
  getHousekeepingRequests,
  getHumanHandoffTranscript,
  getHumanHandoffs,
  getRoomServiceOrders,
} from "@/lib/data/operations";

export const dynamic = "force-dynamic";

const VALID_TABS = new Set([
  "housekeeping",
  "room-service",
  "arrival-requests",
  "human-handoffs",
]);

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; handoff?: string }>;
}) {
  const userTenant = await getCurrentUserTenant();
  if (!userTenant) redirect("/onboarding");

  const params = await searchParams;
  const selectedHandoffId = params.handoff ?? null;
  const currentTab = selectedHandoffId
    ? "human-handoffs"
    : VALID_TABS.has(params.tab ?? "")
      ? (params.tab as string)
      : "housekeeping";

  const [housekeepingData, roomServiceData, arrivalRequestsData, handoffData] =
    await Promise.all([
      getHousekeepingRequests(userTenant.tenantId),
      getRoomServiceOrders(userTenant.tenantId),
      getArrivalRequests(userTenant.tenantId),
      getHumanHandoffs(userTenant.tenantId),
    ]);

  const housekeepingRequests = housekeepingData as unknown as HousekeepingRequest[];
  const roomServiceOrders = roomServiceData as unknown as RoomServiceOrder[];
  const arrivalRequests = arrivalRequestsData as unknown as ArrivalRequest[];
  const selectedHandoff =
    handoffData.find((handoff) => handoff.id === selectedHandoffId) ?? null;
  const selectedHandoffTranscript = selectedHandoff
    ? await getHumanHandoffTranscript(userTenant.tenantId, selectedHandoff.id)
    : [];
  const activeHandoffCount = handoffData.filter(
    (handoff) => handoff.session_status === "handoff" && handoff.needs_human_follow_up,
  ).length;

  const summaryItems = [
    {
      label: "Housekeeping pending",
      color: "yellow",
      value: housekeepingRequests.filter((request) => request.status === "pending").length,
    },
    {
      label: "Room service pending",
      color: "orange",
      value: roomServiceOrders.filter((order) => order.status === "pending").length,
    },
    {
      label: "Arrival requests active",
      color: "cyan",
      value: arrivalRequests.filter((request) => ["pending", "in-progress"].includes(request.status)).length,
    },
    { label: "Human handoffs", color: "violet", value: activeHandoffCount },
  ];

  return (
    <PageAutoRefresh intervalMs={10_000}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Title order={2}>Operations Dashboard</Title>
            <Text c="dimmed" size="sm">
              Ringkasan antrean operasional hotel, termasuk handoff percakapan yang perlu ditinjau staf.
            </Text>
          </Stack>
        </Group>

        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
          {summaryItems.map((item) => (
            <Card key={item.label} withBorder radius="md" padding="md">
              <Stack gap={4}>
                <Badge color={item.color} variant="light" radius="sm" w="fit-content">{item.label}</Badge>
                <Text fw={700} size="xl">{item.value}</Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Card withBorder radius="md" padding="lg">
          <OperationsTabs
            housekeepingData={housekeepingRequests}
            roomServiceData={roomServiceOrders}
            arrivalRequestsData={arrivalRequests}
            humanHandoffsData={handoffData}
            currentTab={currentTab}
            selectedHandoff={selectedHandoff}
            selectedHandoffTranscript={selectedHandoffTranscript}
          />
        </Card>
      </Stack>
    </PageAutoRefresh>
  );
}
