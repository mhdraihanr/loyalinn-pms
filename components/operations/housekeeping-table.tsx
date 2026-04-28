"use client";

import { useEffect, useState } from "react";
import { Table, Text, Badge, Box, Group, Button, Stack } from "@mantine/core";
import { createClient } from "@/lib/supabase/client";
import { updateHousekeepingStatus } from "@/lib/actions/operations";

export type HousekeepingRequest = {
  id: string;
  room_number: string;
  request_type: string;
  details: Record<string, unknown> | null;
  status: string;
  created_at: string;
  guests: { name: string } | null;
};

const statusColors: Record<string, string> = {
  pending: "yellow",
  "in-progress": "blue",
  completed: "green",
  cancelled: "red",
};

function formatDetails(details: Record<string, unknown> | null): {
  description: string;
  extraItems: string[];
} {
  if (!details) return { description: "—", extraItems: [] };

  const description =
    typeof details.details === "string" ? details.details : "";

  const extraItems = Array.isArray(details.extra_items)
    ? (details.extra_items as string[]).filter(
        (item) => typeof item === "string" && item.trim() !== ""
      )
    : [];

  return { description: description || "—", extraItems };
}

export function HousekeepingTable({
  initialData,
}: {
  initialData: HousekeepingRequest[];
}) {
  const [requests, setRequests] = useState<HousekeepingRequest[]>(initialData);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("housekeeping-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "housekeeping_requests",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newReq = payload.new as HousekeepingRequest;
            setRequests((prev) => [newReq, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) =>
              prev.map((req) =>
                req.id === payload.new.id
                  ? { ...req, ...payload.new }
                  : req
              )
            );
          } else if (payload.eventType === "DELETE") {
            setRequests((prev) => prev.filter((req) => req.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleStatusChange = async (id: string, newStatus: "in-progress" | "completed") => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: newStatus } : req))
    );
    await updateHousekeepingStatus(id, newStatus);
  };

  if (requests.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Text c="dimmed">No pending housekeeping requests.</Text>
      </Box>
    );
  }

  return (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Time</Table.Th>
          <Table.Th>Room</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>Details</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {requests.map((req) => (
          <Table.Tr key={req.id}>
            <Table.Td>
              <Text size="sm">{new Date(req.created_at).toLocaleTimeString()}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>{req.room_number}</Text>
              <Text size="xs" c="dimmed">{req.guests?.name || "Unknown"}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" tt="capitalize">{req.request_type}</Text>
            </Table.Td>
            <Table.Td>
              {(() => {
                const { description, extraItems } = formatDetails(req.details);
                return (
                  <Stack gap={2}>
                    <Text size="sm">{description}</Text>
                    {extraItems.length > 0 && (
                      <Group gap={4}>
                        {extraItems.map((item, idx) => (
                          <Badge key={idx} size="xs" variant="outline" color="gray">
                            {item}
                          </Badge>
                        ))}
                      </Group>
                    )}
                  </Stack>
                );
              })()}
            </Table.Td>
            <Table.Td>
              <Badge color={statusColors[req.status] || "gray"} variant="light">
                {req.status}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Group gap="xs">
                {req.status === "pending" && (
                  <Button size="xs" variant="light" onClick={() => handleStatusChange(req.id, "in-progress")}>
                    Start
                  </Button>
                )}
                {req.status === "in-progress" && (
                  <Button size="xs" color="green" onClick={() => handleStatusChange(req.id, "completed")}>
                    Complete
                  </Button>
                )}
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
