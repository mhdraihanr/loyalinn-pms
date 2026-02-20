import { redirect } from "next/navigation";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { getGuests } from "@/lib/data/guests";
import { Card, Title, Stack, Text, Group } from "@mantine/core";
import { GuestsTable } from "@/components/guests/guests-table";

export default async function GuestsPage() {
  const userTenant = await getCurrentUserTenant();

  if (!userTenant) redirect("/onboarding");

  const guests = await getGuests(userTenant.tenantId);

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Title order={2}>Guests</Title>
          <Text c="dimmed" size="sm">
            {guests.length} guest{guests.length !== 1 ? "s" : ""} total
          </Text>
        </Stack>
      </Group>

      <Card withBorder radius="md" padding="lg">
        <GuestsTable guests={guests} />
      </Card>
    </Stack>
  );
}
