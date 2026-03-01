import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth/tenant";
import { redirect } from "next/navigation";
import { InvitationsTable } from "@/components/settings/team/invitations-table";
import { MembersTable } from "@/components/settings/team/members-table";
import {
  resendInvitation,
  revokeInvitation,
  removeStaffMember,
} from "@/lib/auth/invitations";
import { revalidatePath } from "next/cache";
import { Title, Text, Card, Stack } from "@mantine/core";

export default async function TeamSettingsPage() {
  const userTenant = await requireOwner();
  if (!userTenant) redirect("/login");

  const supabase = await createClient();

  // 1. Fetch Invitations
  const { data: invitations } = await supabase
    .from("invitations")
    .select("*")
    .eq("tenant_id", userTenant.tenantId)
    .eq("status", "pending");

  // 2. Fetch Members
  // tenant_users doesn't store emails. We need to fetch user_id and then in a real scenario we might have emails in auth.users
  // Using an admin client or a view would be better if we needed emails. Since we don't have direct access in public schema,
  // Let's just fetch from tenant_users and assume we will enrich them or just show user_id for now.
  const { data: members } = await supabase
    .from("tenant_users")
    .select("user_id, role, created_at")
    .eq("tenant_id", userTenant.tenantId);

  // Server Actions
  async function handleResend(id: string) {
    "use server";
    const userTenant = await requireOwner();
    await resendInvitation(userTenant.userId, id);
    revalidatePath("/settings/team");
  }

  async function handleRevoke(id: string) {
    "use server";
    const userTenant = await requireOwner();
    await revokeInvitation(userTenant.userId, id);
    revalidatePath("/settings/team");
  }

  async function handleRemove(targetUserId: string) {
    "use server";
    const userTenant = await requireOwner();
    await removeStaffMember(userTenant.userId, targetUserId);
    revalidatePath("/settings/team");
  }

  return (
    <div className="space-y-6">
      <div>
        <Title order={1} className="text-3xl font-bold tracking-tight">
          Team Management
        </Title>
        <Text c="dimmed">Manage your hotel staff and invitations.</Text>
      </div>

      <Stack gap="xl">
        <Card withBorder padding="md" radius="md">
          <Title order={3} mb="md">
            Active Members
          </Title>
          <MembersTable
            initialMembers={(members || []).map((m) => ({
              ...m,
              email: m.user_id,
            }))} // Fallback to ID due to auth.users restriction
            currentUserId={userTenant.userId}
            removeAction={handleRemove}
          />
        </Card>

        <Card withBorder padding="md" radius="md">
          <Title order={3} mb="md">
            Pending Invitations
          </Title>
          <InvitationsTable
            initialInvitations={invitations || []}
            resendAction={handleResend}
            revokeAction={handleRevoke}
          />
        </Card>
      </Stack>
    </div>
  );
}
