"use client";

import { useActionState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Text,
  Alert,
  Stack,
  Anchor,
  Divider,
  Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { loginUser } from "@/lib/auth/login";

function LoginForm() {
  const [state, action, pending] = useActionState(loginUser, {});
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token") ?? "";

  useEffect(() => {
    if (searchParams.get("registered") === "1") {
      notifications.show({
        title: "Account created!",
        message: inviteToken
          ? "Please log in to finish accepting your invitation."
          : "Please log in with your email and password.",
        color: "green",
      });
    }
  }, [searchParams, inviteToken]);

  return (
    <Box w="100%" maw={420} px="md">
      <Paper radius="md" p="xl" withBorder shadow="sm">
        <Title order={2} ta="center" mb="xs">
          Welcome back
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Sign in to your hotel management account
        </Text>

        {state.error && (
          <Alert color="red" mb="md" radius="md">
            {state.error}
          </Alert>
        )}

        <form action={action}>
          {/* Pass invite_token through login so server action can redirect correctly */}
          <input
            type="hidden"
            name="invite_token"
            value={inviteToken || ""}
            suppressHydrationWarning
          />

          <Stack gap="md">
            <TextInput
              name="email"
              label="Email"
              placeholder="you@hotel.com"
              type="email"
              required
              autoComplete="email"
            />
            <PasswordInput
              name="password"
              label="Password"
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
            <Button type="submit" fullWidth loading={pending} mt="xs">
              Sign in
            </Button>
          </Stack>
        </form>

        <Divider my="md" />

        <Text size="sm" ta="center" c="dimmed">
          Don&apos;t have an account?{" "}
          <Anchor
            href={
              inviteToken ? `/signup?invite_token=${inviteToken}` : "/signup"
            }
            size="sm"
            fw={500}
            suppressHydrationWarning
          >
            Create account
          </Anchor>
        </Text>
      </Paper>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
