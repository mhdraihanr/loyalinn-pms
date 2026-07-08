"use client";

import Image from "next/image";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconBrandWhatsapp,
  IconRobot,
  IconRoute,
  IconWebhook,
} from "@tabler/icons-react";
import { signupUser } from "@/lib/auth/signup";

const palette = {
  ink: "#0f172a",
};

const features = [
  { label: "Lifecycle Guest Service", icon: IconRoute },
  { label: "WhatsApp Integration", icon: IconBrandWhatsapp },
  { label: "Smart LLM Agent", icon: IconRobot },
  { label: "Reliable Webhook & Audit Log", icon: IconWebhook },
];

function HospiFlowLogo({ dark = false }: { dark?: boolean }) {
  const width = dark ? 240 : 136;
  const height = dark ? 70 : 48;

  return (
    <Stack gap={4} align={dark ? "flex-start" : "center"}>
      <Box style={{ width, height, position: "relative" }}>
        <Image
          src={dark ? "/Logo_Hospiflow_hospi_putih.png" : "/hospiflow-logo.png"}
          alt="HospiFlow"
          fill
          priority
          sizes={`${width}px`}
          style={{
            objectFit: "contain",
            objectPosition: dark ? "left center" : "center",
          }}
        />
      </Box>
    </Stack>
  );
}

function BrandPanel() {
  return (
    <Box
      p={{ base: "lg", md: 40 }}
      style={{
        minHeight: "100dvh",
        color: "white",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 18% 14%, rgba(37, 99, 235, 0.26), transparent 32%), radial-gradient(circle at 82% 82%, rgba(34, 211, 238, 0.18), transparent 34%), linear-gradient(150deg, #061733 0%, #0a2348 54%, #041025 100%)",
        }}
      />
      <Box
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.14,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
        }}
      />

      <Stack gap="lg" style={{ position: "relative" }}>
        <HospiFlowLogo dark />

        <Stack gap="lg" maw={620}>
          <Badge color="cyan" variant="light" w="fit-content">
            Hospitality-tech command center
          </Badge>
          <Title order={1} size="2.35rem" lh={1.04} c="white">
            AI-Powered Guest Service Seamlessly Connected.
          </Title>
          <Text size="lg" c="blue.1" lh={1.65} maw={540}>
            HospiFlow membantu tim hotel menghubungkan PMS, WhatsApp, dan LLM
            Agent untuk melayani tamu lebih cepat, rapi, dan mudah diaudit.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" maw={600}>
          {features.map((feature) => (
            <Paper
              key={feature.label}
              radius="md"
              p="lg"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(255, 255, 255, 0.055))",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                boxShadow:
                  "inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 14px 34px rgba(2, 8, 23, 0.16)",
              }}
            >
              <Group gap="md" wrap="nowrap">
                <ThemeIcon color="cyan" variant="light" radius="md" size={30}>
                  <feature.icon size={19} />
                </ThemeIcon>
                <Text size="sm" fw={700} c="white">
                  {feature.label}
                </Text>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      </Stack>
    </Box>
  );
}

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
    <Box
      p={{ base: "lg", md: 40 }}
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 0% 48%, rgba(6, 23, 51, 0.045), transparent 24%), radial-gradient(circle at 18% 12%, rgba(34, 211, 238, 0.1), transparent 30%), radial-gradient(circle at 84% 20%, rgba(37, 99, 235, 0.08), transparent 34%), linear-gradient(180deg, #f3f8ff 0%, #f8fbff 48%, #eef6ff 100%)",
      }}
    >
      <Box w="100%" maw={382}>
        <Stack gap="md">
          <Stack gap={4} align="center" ta="center">
            <HospiFlowLogo />
            <Title order={2} size="1.48rem" c={palette.ink} mt={2}>
              {isInvited ? "Selesaikan akun Anda" : "Buat akun HospiFlow"}
            </Title>
            <Text c="dimmed" size="xs">
              {isInvited
                ? "Buat password untuk menerima undangan hotel."
                : "Buat akun terlebih dahulu. Setelah login, Anda dapat membuat workspace hotel."}
            </Text>
          </Stack>

          {isInvited && (
            <Alert color="cyan" radius="md" variant="light">
              Email undangan dikunci agar akses masuk ke hotel yang tepat.
            </Alert>
          )}

          {state.error && (
            <Alert color="red" radius="md">
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

            <Stack gap="sm">
              <TextInput
                name="email"
                label="Email"
                placeholder="nama@hotel.com"
                type="email"
                required
                autoComplete="email"
                error={state.fieldErrors?.email}
                // Lock field for invited staff
                value={isInvited ? lockedEmail : undefined}
                readOnly={isInvited}
                rightSection={
                  isInvited ? (
                    <Badge size="xs" color="cyan" variant="light" mr={4}>
                      Terkunci
                    </Badge>
                  ) : undefined
                }
                rightSectionWidth={isInvited ? 74 : undefined}
                size="sm"
                radius="md"
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
                placeholder="Minimal 8 karakter"
                description="Minimal 8 karakter."
                required
                autoComplete="new-password"
                error={state.fieldErrors?.password}
                size="sm"
                radius="md"
              />
              <PasswordInput
                name="confirmPassword"
                label="Konfirmasi password"
                placeholder="Ulangi password Anda"
                required
                autoComplete="new-password"
                error={state.fieldErrors?.confirmPassword}
                size="sm"
                radius="md"
              />
              <Button
                type="submit"
                fullWidth
                loading={pending}
                size="sm"
                mt={4}
                style={{
                  background:
                    "linear-gradient(135deg, #2563eb 0%, #0891b2 100%)",
                }}
              >
                {isInvited ? "Buat akun & lanjutkan undangan" : "Buat akun"}
              </Button>
            </Stack>
          </form>

          <Text size="xs" ta="center" c="dimmed" mt="xs">
            {isInvited
              ? "Sudah punya akun? "
              : "Sudah punya akun? "}
            <Anchor
              href={isInvited ? `/login?invite_token=${inviteToken}` : "/login"}
              size="xs"
              fw={600}
            >
              {isInvited ? "Masuk untuk menerima undangan" : "Masuk di sini"}
            </Anchor>
            .
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <Box className="login-split-shell">
        <BrandPanel />
        <SignupForm />
      </Box>
    </Suspense>
  );
}
