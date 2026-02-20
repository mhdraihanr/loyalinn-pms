"use client";

import { useActionState, Suspense } from "react";
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
  Badge,
} from "@mantine/core";
import { signupUser } from "@/lib/auth/signup";

function SignupForm() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite_token") ?? "";

  // When coming from an invite link, the server pre-resolved the invited_email
  // and passed it as a query param (set by accept-invite/page.tsx redirect).
  // We lock the email field so staff cannot change it.
  const lockedEmail = searchParams.get("email") ?? "";
  const isInvited = Boolean(inviteToken);

  const [state, action, pending] = useActionState(signupUser, {});

  return (
    <Box w="100%" maw={440} px="md">
      <Paper radius="md" p="xl" withBorder shadow="sm">
        <Title order={2} ta="center" mb="xs">
          {isInvited ? "Complete your account" : "Create account"}
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          {isInvited
            ? "Set a password to finish accepting your hotel invitation."
            : "Register your account. You\u2019ll set up your hotel after signing in."}
        </Text>

        {isInvited && (
          <Alert color="teal" mb="md" radius="md" variant="light">
            You&apos;re registering with your invited email. The address is
            locked and cannot be changed.
          </Alert>
        )}

        {state.error && (
          <Alert color="red" mb="md" radius="md">
            {state.error}
          </Alert>
        )}

        <form action={action}>
          {/* Pass invite_token and locked email as hidden fields */}
          {isInvited && (
            <>
              <input type="hidden" name="invite_token" value={inviteToken} />
              <input type="hidden" name="locked_email" value={lockedEmail} />
            </>
          )}

          <Stack gap="md">
            <TextInput
              name="email"
              label="Email"
              placeholder="you@hotel.com"
              type="email"
              required
              autoComplete="email"
              error={state.fieldErrors?.email}
              // Lock field for invited staff
              value={isInvited ? lockedEmail : undefined}
              readOnly={isInvited}
              rightSection={
                isInvited ? (
                  <Badge size="xs" color="teal" variant="light" mr={4}>
                    Locked
                  </Badge>
                ) : undefined
              }
              rightSectionWidth={isInvited ? 64 : undefined}
              styles={
                isInvited
                  ? {
                      input: {
                        backgroundColor: "var(--mantine-color-gray-0)",
                        cursor: "not-allowed",
                      },
                    }
                  : undefined
              }
            />
            <PasswordInput
              name="password"
              label="Password"
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
              error={state.fieldErrors?.password}
            />
            <PasswordInput
              name="confirmPassword"
              label="Confirm password"
              placeholder="Repeat your password"
              required
              autoComplete="new-password"
              error={state.fieldErrors?.confirmPassword}
            />
            <Button type="submit" fullWidth loading={pending} mt="xs">
              {isInvited ? "Create account & accept invite" : "Create account"}
            </Button>
          </Stack>
        </form>

        <Divider my="md" />

        <Text size="sm" ta="center" c="dimmed">
          Already have an account?{" "}
          <Anchor
            href={isInvited ? `/login?invite_token=${inviteToken}` : "/login"}
            size="sm"
            fw={500}
          >
            Sign in
          </Anchor>
        </Text>
      </Paper>
    </Box>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
