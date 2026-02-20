import { Title, Text, Group, Box } from "@mantine/core";
import { getPmsConfig } from "@/lib/pms/config";
import { PmsConfigForm } from "@/components/settings/pms/pms-config-form";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";

export const metadata = {
  title: "PMS Configuration | Settings",
};

export default async function PmsSettingsPage() {
  const tenantUser = await getCurrentUserTenant();
  if (!tenantUser) redirect("/onboarding");

  // Only owners can access PMS settings
  if (tenantUser.role !== "owner") {
    redirect("/");
  }

  const pmsConfig = await getPmsConfig();

  return (
    <Box>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>PMS Configuration</Title>
          <Text c="dimmed" size="sm">
            Manage your Property Management System integration
          </Text>
        </div>
      </Group>

      <PmsConfigForm initialData={pmsConfig} />
    </Box>
  );
}
