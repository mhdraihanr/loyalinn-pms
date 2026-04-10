import { Box, Title, Text, Card } from "@mantine/core";
import { DeveloperTimeMachine } from "@/components/settings/developer-time-machine";

export default function DeveloperSettingsPage() {
  if (process.env.NODE_ENV !== "development") {
    return (
      <Box p="md">
        <Title order={1}>Access Denied</Title>
        <Text>This page is only available in development mode.</Text>
      </Box>
    );
  }

  return (
    <Box className="space-y-6 max-w-2xl">
      <div>
        <Title order={1} className="text-3xl font-bold tracking-tight">
          Developer Tools
        </Title>
        <Text c="dimmed">
          Internal tools for testing and debugging the automation engine.
        </Text>
      </div>

      <Card withBorder padding="lg" radius="md">
        <Title order={3} mb="sm">
          Time Machine (Automation Scheduler)
        </Title>
        <Text c="dimmed" mb="lg">
          Simulate a specific exact date and time for the automation Worker.
          This will bypass the real-world clock and trigger any scheduled
          `pre-arrival` or `post-stay` jobs based on the time you choose. Useful
          for testing same-day bounds or future bookings.
        </Text>
        <DeveloperTimeMachine />
      </Card>
    </Box>
  );
}
