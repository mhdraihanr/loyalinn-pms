"use client";

import Image from "next/image";
import { Suspense, useActionState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
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
  IconShieldCheck,
  IconWebhook,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { loginUser } from "@/lib/auth/login";

const palette = {
  navy: "#061733",
  navy2: "#0b2a55",
  electric: "#2563eb",
  cyan: "#22d3ee",
  surface: "#ffffff",
  soft: "#f5f8ff",
  line: "#dbeafe",
  ink: "#0f172a",
  muted: "#64748b",
};

const features = [
  { label: "Lifecycle Guest Service", icon: IconRoute },
  { label: "WhatsApp Integration", icon: IconBrandWhatsapp },
  { label: "Smart LLM Agent", icon: IconRobot },
  { label: "Reliable Webhook & Audit Log", icon: IconWebhook },
];

function HospiFlowLogo({
  dark = false,
  showTagline = true,
}: {
  dark?: boolean;
  showTagline?: boolean;
}) {
  const width = dark ? 240 : 136;
  const height = dark ? 70 : 48;

  return (
    <Stack gap={4} align={dark ? "flex-start" : "center"}>
      <Box
        style={{
          width,
          height,
          position: "relative",
        }}
      >
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
        overflow: "visible",
      }}
    >
      <Box
        style={{
          position: "absolute",
          inset: 0,
          right: -1,
          background:
            "radial-gradient(circle at 18% 14%, rgba(37, 99, 235, 0.26), transparent 32%), radial-gradient(circle at 82% 82%, rgba(34, 211, 238, 0.18), transparent 34%), linear-gradient(150deg, #061733 0%, #0a2348 54%, #041025 100%)",
          maskImage:
            "linear-gradient(90deg, #000 0%, #000 calc(100% - 52px), rgba(0, 0, 0, 0.76) calc(100% - 34px), rgba(0, 0, 0, 0.34) calc(100% - 14px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, #000 0%, #000 calc(100% - 52px), rgba(0, 0, 0, 0.76) calc(100% - 34px), rgba(0, 0, 0, 0.34) calc(100% - 14px), transparent 100%)",
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
          maskImage:
            "linear-gradient(90deg, #000 0%, #000 calc(100% - 56px), rgba(0, 0, 0, 0.36) calc(100% - 18px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, #000 0%, #000 calc(100% - 56px), rgba(0, 0, 0, 0.36) calc(100% - 18px), transparent 100%)",
        }}
      />
      <Box
        style={{
          position: "absolute",
          top: 0,
          right: -18,
          bottom: 0,
          width: 72,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background:
            "linear-gradient(90deg, rgba(243, 248, 255, 0), rgba(243, 248, 255, 0.16) 70%, rgba(243, 248, 255, 0.26))",
          maskImage:
            "linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.18) 24%, rgba(0, 0, 0, 0.72) 68%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, rgba(0, 0, 0, 0.18) 24%, rgba(0, 0, 0, 0.72) 68%, transparent 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      <Stack gap="lg" style={{ position: "relative" }}>
        <HospiFlowLogo dark />

        <Stack gap="md" maw={620}>
          <Badge color="cyan" variant="light" w="fit-content">
            Hospitality-tech command center
          </Badge>
          <Title order={1} size="2.35rem" lh={1.04} c="white">
            AI-Powered Guest Service Seamlessly Connected.
          </Title>
          <Text size="sm" c="blue.1" lh={1.65} maw={540}>
            HospiFlow membantu tim hotel menghubungkan PMS, WhatsApp, dan LLM
            Agent untuk melayani tamu lebih cepat, rapi, dan mudah diaudit.
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" maw={600}>
          {features.map((feature) => (
            <Paper
              key={feature.label}
              radius="md"
              p="md"
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.13)",
                backdropFilter: "blur(16px)",
              }}
            >
              <Group gap="sm" wrap="nowrap">
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
      <Box w="100%" maw={392}>
        <Paper
          radius={28}
          p={{ base: "md", sm: 20 }}
          style={{
            background: palette.surface,
            border: `1px solid ${palette.line}`,
            boxShadow: "0 28px 90px rgba(15, 23, 42, 0.12)",
          }}
        >
          <Stack gap="sm">
            <Stack gap={4} align="center" ta="center">
              <HospiFlowLogo showTagline={false} />
              <Title order={2} size="1.48rem" c={palette.ink} mt={2}>
                Masuk ke akun Anda
              </Title>
              <Text c="dimmed" size="xs">
                Kelola layanan tamu hotel dengan lebih cerdas.
              </Text>
            </Stack>

            {state.error && (
              <Alert color="red" radius="md">
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

              <Stack gap="sm">
                <TextInput
                  name="email"
                  label="Email"
                  placeholder="nama@hotel.com"
                  type="email"
                  required
                  autoComplete="email"
                  size="sm"
                  radius="md"
                />
                <PasswordInput
                  name="password"
                  label="Password"
                  placeholder="Masukkan password"
                  required
                  autoComplete="current-password"
                  size="sm"
                  radius="md"
                />
                <Group justify="space-between" align="center">
                  <Checkbox label="Ingat saya" size="sm" />
                  <Anchor href="mailto:admin@hospiflow.local" size="sm" fw={600}>
                    Lupa password?
                  </Anchor>
                </Group>
                <Button
                  type="submit"
                  fullWidth
                  loading={pending}
                  size="sm"
                  mt={4}
                  style={{
                    background:
                      "linear-gradient(135deg, #2563eb 0%, #0891b2 100%)",
                    boxShadow: "0 16px 34px rgba(37, 99, 235, 0.28)",
                  }}
                >
                  Masuk
                </Button>
              </Stack>
            </form>

            <Text size="xs" ta="center" c="dimmed">
              Belum memiliki akses? Hubungi administrator hotel Anda, atau{" "}
              <Anchor
                href={
                  inviteToken ? `/signup?invite_token=${inviteToken}` : "/signup"
                }
                size="xs"
                fw={600}
                suppressHydrationWarning
              >
                daftar di sini
              </Anchor>
              .
            </Text>
          </Stack>
        </Paper>

        <Group justify="center" gap="xs" mt="sm">
          <IconShieldCheck size={16} color={palette.muted} />
          <Text size="xs" c="dimmed">
            Dilindungi Supabase Auth dan akses tenant hotel.
          </Text>
        </Group>
      </Box>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Box className="login-split-shell">
        <BrandPanel />
        <LoginForm />
      </Box>
    </Suspense>
  );
}
