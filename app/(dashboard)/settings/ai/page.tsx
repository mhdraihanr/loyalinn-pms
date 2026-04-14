import { Box, Text, Title } from "@mantine/core";
import { redirect } from "next/navigation";

import {
  AiSettingsForm,
  type AiSettingsFormValues,
} from "@/components/settings/ai/ai-settings-form";
import { getCurrentUserTenant } from "@/lib/auth/tenant";
import {
  getCurrentTenantAiSettings,
  upsertCurrentTenantAiSettings,
} from "@/lib/ai/settings";

export const metadata = {
  title: "AI Assistant Settings | Settings",
};

export default async function AiSettingsPage() {
  const tenantUser = await getCurrentUserTenant();
  if (!tenantUser) {
    redirect("/onboarding");
  }

  if (tenantUser.role !== "owner") {
    redirect("/");
  }

  const currentSettings = await getCurrentTenantAiSettings();

  const initialValues: AiSettingsFormValues = {
    hotel_name: currentSettings?.hotel_name ?? "",
    ai_name: currentSettings?.ai_name ?? "",
    tone_of_voice: currentSettings?.tone_of_voice ?? "",
    custom_instructions: currentSettings?.custom_instructions ?? "",
  };

  async function saveAction(values: AiSettingsFormValues) {
    "use server";

    const result = await upsertCurrentTenantAiSettings(values);
    if (result.error) {
      throw new Error(result.error);
    }
  }

  return (
    <Box className="space-y-6 max-w-3xl">
      <div>
        <Title order={1} className="text-3xl font-bold tracking-tight">
          AI Assistant Settings
        </Title>
        <Text c="dimmed">
          Kelola nama hotel, persona AI, dan instruksi khusus agar follow-up
          feedback lebih personal.
        </Text>
      </div>

      <AiSettingsForm initialValues={initialValues} saveAction={saveAction} />
    </Box>
  );
}
