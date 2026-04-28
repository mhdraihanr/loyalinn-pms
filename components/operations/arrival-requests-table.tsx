"use client";

import { useEffect, useState } from "react";
import { Badge, Box, Button, Group, Stack, Table, Text } from "@mantine/core";
import { updateArrivalRequestStatus } from "@/lib/actions/operations";
import { createClient } from "@/lib/supabase/client";

export type ArrivalRequest = {
  id: string;
  room_number: string;
  request_type: "arrival_eta" | "early_checkin";
  eta: string | null;
  requested_time: string | null;
  details: Record<string, unknown> | null;
  status: string;
  created_at: string;
  guests: { name: string } | null;
  reservations: { check_in_date: string } | null;
};

const statusColors: Record<string, string> = {
  pending: "yellow",
  "in-progress": "blue",
  resolved: "green",
  cancelled: "red",
};

const requestLabels: Record<ArrivalRequest["request_type"], string> = {
  arrival_eta: "Arrival ETA",
  early_checkin: "Early Check-in",
};

function getDetailText(request: ArrivalRequest) {
  const note =
    typeof request.details?.notes === "string" ? request.details.notes : null;
  const reason =
    typeof request.details?.reason === "string" ? request.details.reason : null;
  return note ?? reason ?? "-";
}

export function ArrivalRequestsTable({
  initialData,
}: {
  initialData: ArrivalRequest[];
}) {
  const [requests, setRequests] = useState<ArrivalRequest[]>(initialData);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("arrival-requests-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "arrival_requests",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newRequest = payload.new as ArrivalRequest;
            setRequests((prev) => [newRequest, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) =>
              prev.map((request) =>
                request.id === payload.new.id
                  ? { ...request, ...payload.new }
                  : request,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setRequests((prev) =>
              prev.filter((request) => request.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleStatusChange = async (
    id: string,
    newStatus: "in-progress" | "resolved" | "cancelled",
  ) => {
    setRequests((prev) =>
      prev.map((request) =>
        request.id === id ? { ...request, status: newStatus } : request,
      ),
    );
    await updateArrivalRequestStatus(id, newStatus);
  };

  if (requests.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Text c="dimmed">No pending arrival requests.</Text>
      </Box>
    );
  }

  return (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Time</Table.Th>
          <Table.Th>Room</Table.Th>
          <Table.Th>Request</Table.Th>
          <Table.Th>Arrival Info</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {requests.map((request) => (
          <Table.Tr key={request.id}>
            <Table.Td>
              <Text size="sm">
                {new Date(request.created_at).toLocaleTimeString()}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>
                {request.room_number}
              </Text>
              <Text size="xs" c="dimmed">
                {request.guests?.name || "Unknown"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge
                color={request.request_type === "early_checkin" ? "orange" : "cyan"}
                variant="light"
              >
                {requestLabels[request.request_type]}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Stack gap={2}>
                {request.eta && <Text size="sm">ETA: {request.eta}</Text>}
                {request.requested_time && (
                  <Text size="sm">Requested: {request.requested_time}</Text>
                )}
                <Text size="xs" c="dimmed">
                  Check-in: {request.reservations?.check_in_date ?? "-"}
                </Text>
                <Text size="xs" c="dimmed">
                  {getDetailText(request)}
                </Text>
              </Stack>
            </Table.Td>
            <Table.Td>
              <Badge color={statusColors[request.status] || "gray"} variant="light">
                {request.status}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Group gap="xs">
                {request.status === "pending" && (
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() =>
                      handleStatusChange(request.id, "in-progress")
                    }
                  >
                    Start
                  </Button>
                )}
                {request.status === "in-progress" && (
                  <Button
                    size="xs"
                    color="green"
                    onClick={() => handleStatusChange(request.id, "resolved")}
                  >
                    Resolve
                  </Button>
                )}
                {request.status !== "resolved" && (
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => handleStatusChange(request.id, "cancelled")}
                  >
                    Cancel
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
