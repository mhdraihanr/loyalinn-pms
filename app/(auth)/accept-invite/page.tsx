import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getInvitationByToken,
  acceptStaffInvitation,
} from "@/lib/auth/invitations";
import {
  Box,
  Paper,
  Title,
  Text,
  Stack,
  ThemeIcon,
  Group,
} from "@mantine/core";
import { IconMailCheck } from "@tabler/icons-react";
import { AcceptInviteButton } from "@/components/auth/accept-invite-button";
import { InviteErrorBox } from "@/components/auth/invite-error-box";

// ─────────────────────────────────────────────────────────────────────────────

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // ── 1. Token must be present ──────────────────────────────────────────────
  if (!token) {
    return (
      <InviteErrorBox message="No invite token found. Make sure you clicked the full link from your email." />
    );
  }

  // ── 2. Look up invitation (admin client — bypasses RLS) ───────────────────
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return (
      <InviteErrorBox message="This invite link is invalid or has expired. Ask your hotel owner to re-invite you." />
    );
  }

  if (invitation.status === "accepted") {
    redirect("/login");
  }

  if (
    invitation.status === "expired" ||
    new Date(invitation.expires_at) < new Date()
  ) {
    return (
      <InviteErrorBox message="This invite link has expired (7-day limit). Ask your hotel owner to re-invite you." />
    );
  }

  // ── 3. Check if invited email is already a registered Supabase user ───────
  const admin = createAdminClient();
  const { data: userList } = await admin.auth.admin.listUsers();
  const existingUser = userList?.users?.find(
    (u) => u.email?.toLowerCase() === invitation.invited_email.toLowerCase(),
  );

  // ── 4. If not registered → redirect to /signup with locked email ──────────
  if (!existingUser) {
    redirect(
      `/signup?invite_token=${token}&email=${encodeURIComponent(invitation.invited_email)}`,
    );
  }

  // ── 5. If registered but not logged in → redirect to /login ───────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?invite_token=${token}`);
  }

  // ── 6. Make sure logged-in user matches invited email ─────────────────────
  if (user.email?.toLowerCase() !== invitation.invited_email.toLowerCase()) {
    return (
      <InviteErrorBox
        message={`This invitation was sent to ${invitation.invited_email}. Please log in with that account to accept it.`}
      />
    );
  }

  // ── 7. Already has a tenant? ──────────────────────────────────────────────
  const { data: existingMember } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember) {
    redirect("/");
  }

  // ── 8. Get tenant name for display ────────────────────────────────────────
  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", invitation.tenant_id)
    .single();

  // ── 9. Server action: accept ──────────────────────────────────────────────
  async function handleAccept() {
    "use server";
    await acceptStaffInvitation(user!.id, token!);
    redirect("/");
  }

  return (
    <Box w="100%" maw={440} px="md">
      <Paper radius="md" p="xl" withBorder shadow="sm">
        <Group gap="md" mb="xl" align="center">
          <ThemeIcon size={44} radius="md" variant="light" color="teal">
            <IconMailCheck size={24} />
          </ThemeIcon>
          <Stack gap={2}>
            <Title order={3}>You&apos;ve been invited</Title>
            <Text size="sm" c="dimmed">
              Accept to join your team
            </Text>
          </Stack>
        </Group>

        <Stack gap="sm" mb="xl">
          <Text size="sm">
            You have been invited to join{" "}
            <Text span fw={600}>
              {tenant?.name ?? "a hotel"}
            </Text>
            .
          </Text>
          <Text size="sm" c="dimmed">
            Invited email:{" "}
            <Text span fw={500} c="dark">
              {invitation.invited_email}
            </Text>
          </Text>
        </Stack>

        <form action={handleAccept}>
          <AcceptInviteButton />
        </form>
      </Paper>
    </Box>
  );
}
