"use client";

import { Table, Button, Badge } from "@mantine/core";
import { useState } from "react";
import { notifications } from "@mantine/notifications";

interface MemberRecord {
  user_id: string;
  email: string | null;
  role: string;
  created_at: string;
}

interface MembersTableProps {
  initialMembers: MemberRecord[];
  currentUserId: string;
  removeAction: (userId: string) => Promise<void>;
}

export function MembersTable({
  initialMembers,
  currentUserId,
  removeAction,
}: MembersTableProps) {
  const [members, setMembers] = useState(initialMembers);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleRemove = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    setLoadingId(userId);
    try {
      await removeAction(userId);
      setMembers(members.filter((m) => m.user_id !== userId));
      notifications.show({
        title: "Success",
        message: "Member removed.",
        color: "green",
      });
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.message || "Failed to remove.",
        color: "red",
      });
    } finally {
      setLoadingId(null);
    }
  };

  const rows = members.map((member) => (
    <Table.Tr key={member.user_id}>
      <Table.Td>{member.email || "Unknown User"}</Table.Td>
      <Table.Td>
        <Badge color={member.role === "owner" ? "blue" : "gray"}>
          {member.role}
        </Badge>
      </Table.Td>
      <Table.Td>{new Date(member.created_at).toLocaleDateString()}</Table.Td>
      <Table.Td>
        {member.role !== "owner" && member.user_id !== currentUserId && (
          <Button
            size="xs"
            variant="light"
            color="red"
            onClick={() => handleRemove(member.user_id)}
            loading={loadingId === member.user_id}
          >
            Remove
          </Button>
        )}
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Email</Table.Th>
          <Table.Th>Role</Table.Th>
          <Table.Th>Joined At</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  );
}
