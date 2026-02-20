"use client";

import { useActionState } from "react";
import {
  TextInput,
  Button,
  Paper,
  Title,
  Text,
  Alert,
  Stack,
  Anchor,
  Box,
  ThemeIcon,
  Group,
} from "@mantine/core";
import { IconBuildingSkyscraper } from "@tabler/icons-react";
import { createTenantAction } from "./actions";

export default function CreateTenantPage() {
  const [state, action, pending] = useActionState(createTenantAction, {});

  return (
    <Box w="100%" maw={440} px="md">
      <Paper radius="md" p="xl" withBorder shadow="sm">
        <Group gap="md" mb="xl" align="center">
          <ThemeIcon size={44} radius="md" variant="light" color="blue">
            <IconBuildingSkyscraper size={24} />
          </ThemeIcon>
          <Stack gap={2}>
            <Title order={3}>Register your hotel</Title>
            <Text size="sm" c="dimmed">
              This creates your account&apos;s workspace
            </Text>
          </Stack>
        </Group>

        {state.error && (
          <Alert color="red" mb="md" radius="md">
            {state.error}
          </Alert>
        )}

        <form action={action}>
          <Stack gap="md">
            <TextInput
              name="hotelName"
              label="Hotel name"
              placeholder="e.g. Grand Hyatt Bali"
              required
              autoFocus
              error={state.fieldErrors?.hotelName}
              description="This will be displayed across your dashboard"
            />
            <Button type="submit" fullWidth loading={pending} mt="xs">
              Create hotel workspace
            </Button>
          </Stack>
        </form>

        <Text size="xs" c="dimmed" ta="center" mt="md">
          <Anchor href="/onboarding" size="xs">
            ← Back to options
          </Anchor>
        </Text>
      </Paper>
    </Box>
  );
}
