import {
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Title,
  ThemeIcon,
} from "@mantine/core";
import { IconBuildingSkyscraper, IconMailForward } from "@tabler/icons-react";
import Link from "next/link";

export default function OnboardingPage() {
  return (
    <Box w="100%" maw={520} px="md">
      <Stack gap="xl" align="center">
        <Stack gap="xs" align="center">
          <Title order={2} ta="center">
            Welcome! Let&apos;s get you started
          </Title>
          <Text c="dimmed" size="sm" ta="center" maw={380}>
            How would you like to use the platform? Choose the option that
            applies to you.
          </Text>
        </Stack>

        <Stack gap="md" w="100%">
          {/* Option 1: Create Tenant */}
          <Link
            href="/onboarding/create-tenant"
            style={{ textDecoration: "none" }}
          >
            <Card
              withBorder
              radius="md"
              padding="xl"
              style={{ cursor: "pointer" }}
            >
              <Group gap="lg" align="flex-start">
                <ThemeIcon size={48} radius="md" variant="light" color="blue">
                  <IconBuildingSkyscraper size={26} />
                </ThemeIcon>
                <Stack gap={4} style={{ flex: 1 }}>
                  <Text fw={600} size="lg">
                    I own a hotel
                  </Text>
                  <Text size="sm" c="dimmed">
                    Register your hotel and become the account owner.
                    You&apos;ll be able to configure PMS integration, manage
                    staff, and set up WhatsApp automation.
                  </Text>
                </Stack>
              </Group>
            </Card>
          </Link>

          {/* Option 2: Accept Invite */}
          <Card withBorder radius="md" padding="xl">
            <Group gap="lg" align="flex-start">
              <ThemeIcon size={48} radius="md" variant="light" color="teal">
                <IconMailForward size={26} />
              </ThemeIcon>
              <Stack gap={4} style={{ flex: 1 }}>
                <Text fw={600} size="lg">
                  I was invited to a hotel
                </Text>
                <Text size="sm" c="dimmed">
                  If your hotel owner has sent you an invite via email, check
                  your inbox and click the invitation link to join.
                </Text>
                <Button
                  variant="subtle"
                  size="xs"
                  mt="xs"
                  w="fit-content"
                  c="teal"
                  component="span"
                >
                  Check your email for the invite link
                </Button>
              </Stack>
            </Group>
          </Card>
        </Stack>
      </Stack>
    </Box>
  );
}
