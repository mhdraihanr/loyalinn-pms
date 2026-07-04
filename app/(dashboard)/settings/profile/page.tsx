import { redirect } from "next/navigation";
import {
  Badge,
  Box,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ChangePasswordForm,
  PreferencesForm,
} from "@/components/settings/profile/profile-settings-forms";
import {
  formatUserDate,
  formatUserDateTime,
  getUserPreferencesFromMetadata,
} from "@/lib/user-preferences";

export const metadata = {
  title: "My Profile | Settings",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" gap="xl">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right" style={{ wordBreak: "break-word" }}>
        {value}
      </Text>
    </Group>
  );
}

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: tenantUser, error: tenantUserError } = await admin
    .from("tenant_users")
    .select("tenant_id, role, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (tenantUserError) {
    throw new Error(
      `Failed to load profile membership: ${tenantUserError.message}`,
    );
  }

  if (!tenantUser) redirect("/onboarding");

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("name, slug")
    .eq("id", tenantUser.tenant_id)
    .maybeSingle();

  if (tenantError) {
    throw new Error(`Failed to load profile workspace: ${tenantError.message}`);
  }

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "Not set";
  const initialPreferences = getUserPreferencesFromMetadata(
    user.user_metadata ?? {},
  );

  return (
    <Box className="space-y-6 max-w-5xl">
      <div>
        <Title order={1} className="text-3xl font-bold tracking-tight">
          My Profile
        </Title>
        <Text c="dimmed">
          View your account identity, workspace access, and upcoming personal
          preferences.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card withBorder radius="md" padding="lg">
          <Stack gap="md">
            <div>
              <Title order={3}>Account</Title>
              <Text size="sm" c="dimmed">
                Personal sign-in details from your authenticated account.
              </Text>
            </div>
            <DetailRow label="Full name" value={fullName} />
            <DetailRow label="Email" value={user.email ?? "Not available"} />
            <DetailRow label="User ID" value={user.id} />
            <DetailRow
              label="Last sign-in"
              value={
                user.last_sign_in_at
                  ? formatUserDateTime(user.last_sign_in_at, initialPreferences)
                  : "Not available"
              }
            />
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Stack gap="md">
            <div>
              <Title order={3}>Workspace</Title>
              <Text size="sm" c="dimmed">
                Current hotel workspace and access role.
              </Text>
            </div>
            <DetailRow label="Hotel" value={tenant?.name ?? "Your Hotel"} />
            <DetailRow
              label="Tenant slug"
              value={tenant?.slug ?? "Not available"}
            />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Role
              </Text>
              <Badge
                tt="capitalize"
                color={tenantUser.role === "owner" ? "blue" : "gray"}
              >
                {tenantUser.role}
              </Badge>
            </Group>
            <DetailRow
              label="Joined"
              value={formatUserDate(tenantUser.created_at, initialPreferences)}
            />
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Stack gap="md">
            <div>
              <Title order={3}>Preferences</Title>
              <Text size="sm" c="dimmed">
                Personal timezone, date format, and theme defaults.
              </Text>
            </div>
            <PreferencesForm initialValues={initialPreferences} />
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg">
          <Stack gap="md">
            <div>
              <Group justify="space-between" align="center">
                <Title order={3}>Notifications</Title>
                <Badge variant="light">Coming soon</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Email alerts, feedback escalation alerts, and operations
                notifications will be managed here.
              </Text>
            </div>
            <DetailRow label="Email notifications" value="Coming soon" />
            <DetailRow label="Feedback alerts" value="Coming soon" />
            <DetailRow label="Operations alerts" value="Coming soon" />
          </Stack>
        </Card>

        <Card withBorder radius="md" padding="lg" style={{ gridColumn: "1 / -1" }}>
          <Stack gap="md">
            <div>
              <Title order={3}>Security</Title>
              <Text size="sm" c="dimmed">
                Change your password using the active Supabase Auth session.
              </Text>
            </div>
            <ChangePasswordForm />
          </Stack>
        </Card>
      </SimpleGrid>
    </Box>
  );
}
