import { redirect } from "next/navigation";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { getGuests } from "@/lib/data/guests";
import {
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { GuestsTable } from "@/components/guests/guests-table";
import { PageAutoRefresh } from "@/components/layout/page-auto-refresh";

export default async function GuestsPage() {
  const userTenant = await getCurrentUserTenant();

  if (!userTenant) redirect("/onboarding");

  const guests = await getGuests(userTenant.tenantId);

  const totalGuests = guests.length;
  const tierMembers = guests.filter((guest) => Boolean(guest.tier)).length;
  const guestsWithEmail = guests.filter((guest) => Boolean(guest.email)).length;
  const loyaltyPoints = guests.reduce(
    (sum, guest) => sum + (guest.points ?? 0),
    0,
  );

  const statCards = [
    { label: "Guests overview", value: totalGuests, color: "blue" },
    { label: "Tier members", value: tierMembers, color: "violet" },
    { label: "Guests with email", value: guestsWithEmail, color: "teal" },
    { label: "Loyalty points", value: loyaltyPoints, color: "orange" },
  ];

  return (
    <PageAutoRefresh intervalMs={10_000}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Title order={2}>Guests</Title>
            <Text c="dimmed" size="sm">
              Premium guest directory for loyalty, contact coverage, and stay
              readiness.
            </Text>
          </Stack>
        </Group>

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
                  {stat.value.toLocaleString("en-US")}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>

        <Card withBorder radius="md" padding="lg">
          <GuestsTable guests={guests} />
        </Card>
      </Stack>
    </PageAutoRefresh>
  );
}
