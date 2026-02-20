"use client";

import { useTransition, useState } from "react";
import {
  TextInput,
  PasswordInput,
  Select,
  Switch,
  Button,
  Stack,
  Paper,
  Text,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { savePmsConfig, PmsConfig } from "@/lib/pms/config";

export function PmsConfigForm({
  initialData,
}: {
  initialData: PmsConfig | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Derive initial values securely client-side
  const defaultPms = initialData?.pms_type ?? "cloudbeds";
  const defaultEndpoint = initialData?.endpoint ?? "";
  const defaultApiKey = initialData?.credentials?.api_key ?? "";
  const defaultActive = initialData?.is_active ?? true;

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await savePmsConfig(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      notifications.show({
        title: "PMS Configuration Saved",
        message: "Your changes have been applied successfully.",
        color: "green",
      });
    });
  };

  return (
    <Paper radius="md" p="md" withBorder shadow="sm">
      <Stack gap="xl">
        <div>
          <Text fw={500} size="lg" mb="sm">
            Connection Details
          </Text>
          <Text size="sm" c="dimmed">
            Connect your Property Management System to automatically sync guests
            and reservations.
          </Text>
        </div>

        {error && (
          <Alert color="red" radius="md">
            {error}
          </Alert>
        )}

        <form action={handleSubmit}>
          <Stack gap="md">
            <Select
              name="pms_type"
              label="Integration Provider"
              description="Select your Property Management System"
              placeholder="Pick a provider"
              data={[
                { value: "cloudbeds", label: "Cloudbeds" },
                { value: "mews", label: "Mews" },
                { value: "custom", label: "Custom / Generic" },
              ]}
              defaultValue={defaultPms}
              required
            />

            <TextInput
              name="endpoint"
              label="API Endpoint URL"
              description="The base URL where reservations can be fetched"
              placeholder="https://api.cloudbeds.com/api/v1.1"
              defaultValue={defaultEndpoint}
              required
            />

            <PasswordInput
              name="api_key"
              label="API Key / Secret Token"
              description="We securely encrypt this token before storage"
              placeholder="Your secure API key"
              defaultValue={defaultApiKey}
              required
            />

            <Switch
              name="is_active"
              label="Enable active synchronization"
              description="If disabled, inbound webhooks and data syncs will be ignored"
              defaultChecked={defaultActive}
              mt="sm"
            />

            <Button
              type="submit"
              loading={isPending}
              fullWidth={false}
              mt="sm"
              w="fit-content"
            >
              Save Configuration
            </Button>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}
