import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  Title,
  Stack,
  Text,
  Badge,
  Box,
  Avatar,
  Group,
} from "@mantine/core";
import { GuestsTable } from "@/components/guests/guests-table";

async function getGuests(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guests")
    .select(
      "id, full_name, phone, email, country, tier, loyalty_points, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export default async function GuestsPage() {
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

  const guests = await getGuests(tenantUser.tenant_id);

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
