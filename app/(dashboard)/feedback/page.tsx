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

import { PageAutoRefresh } from "@/components/layout/page-auto-refresh";
import { FeedbackMonitorTable } from "@/components/feedback/feedback-monitor-table";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { getFeedbackMonitorRows } from "@/lib/data/feedback";

export default async function FeedbackMonitorPage() {
  const userTenant = await getCurrentUserTenant();

  if (!userTenant) {
    redirect("/onboarding");
  }

  const rows = await getFeedbackMonitorRows(userTenant.tenantId);

  const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.feedbackStatus] = (acc[row.feedbackStatus] ?? 0) + 1;
    return acc;
  }, {});

  const statusItems = [
    { key: "not-sent", label: "Not Sent", color: "gray" },
    { key: "pending", label: "Pending Form", color: "yellow" },
    { key: "ai_followup", label: "AI Follow-up", color: "blue" },
    { key: "completed", label: "Completed", color: "green" },
    { key: "ignored", label: "Ignored", color: "red" },
  ];

  return (
    <PageAutoRefresh intervalMs={10_000}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Title order={2}>Feedback Monitor</Title>
            <Text c="dimmed" size="sm">
              Pantau status post-stay feedback dari tamu checked-out.
            </Text>
          </Stack>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
          {statusItems.map((item) => (
            <Card key={item.key} withBorder radius="md" padding="md">
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
                  {statusCounts[item.key] ?? 0}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Card withBorder radius="md" padding="lg">
          <FeedbackMonitorTable rows={rows} />
        </Card>
      </Stack>
    </PageAutoRefresh>
  );
}
