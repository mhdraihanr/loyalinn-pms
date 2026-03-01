"use client";

import { Table, Button, Badge } from "@mantine/core";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { InvitationRecord } from "@/lib/auth/invitations";

interface InvitationsTableProps {
  initialInvitations: InvitationRecord[];
  resendAction: (id: string) => Promise<void>;
  revokeAction: (id: string) => Promise<void>;
}

export function InvitationsTable({
  initialInvitations,
  resendAction,
  revokeAction,
}: InvitationsTableProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleResend = async (id: string) => {
    setLoadingId(id);
    try {
      await resendAction(id);
      notifications.show({
        title: "Success",
        message: "Invitation resent.",
        color: "green",
      });
      // In a real app we'd refresh the list, but for UX let's just assume it succeeded.
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.message || "Failed to resend.",
        color: "red",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    setLoadingId(id);
    try {
      await revokeAction(id);
      setInvitations(invitations.filter((i) => i.id !== id));
      notifications.show({
        title: "Success",
        message: "Invitation revoked.",
        color: "green",
      });
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.message || "Failed to revoke.",
        color: "red",
      });
    } finally {
      setLoadingId(null);
    }
  };

  if (invitations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 border rounded-md">
        No pending invitations.
      </div>
    );
  }

  const rows = invitations.map((inv) => (
    <Table.Tr key={inv.id}>
      <Table.Td>{inv.invited_email}</Table.Td>
      <Table.Td>{new Date(inv.created_at).toLocaleDateString()}</Table.Td>
      <Table.Td>{new Date(inv.expires_at).toLocaleDateString()}</Table.Td>
      <Table.Td>
        <Badge color={inv.status === "pending" ? "yellow" : "gray"}>
          {inv.status}
        </Badge>
      </Table.Td>
      <Table.Td>
        <div className="flex gap-2">
          <Button
            size="xs"
            variant="light"
            onClick={() => handleResend(inv.id)}
            loading={loadingId === inv.id}
          >
            Resend
          </Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            onClick={() => handleRevoke(inv.id)}
            loading={loadingId === inv.id}
          >
            Revoke
          </Button>
        </div>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Email</Table.Th>
          <Table.Th>Sent At</Table.Th>
          <Table.Th>Expires At</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  );
}
