"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { IconDoorEnter, IconMessageCircle, IconSearch } from "@tabler/icons-react";
import { OperationChatDrawer } from "@/components/operations/operation-chat-drawer";
import { updateArrivalRequestStatus } from "@/lib/actions/operations";
import { createClient } from "@/lib/supabase/client";
import { useUserPreferences } from "@/components/settings/profile/use-user-preferences";
import { formatUserTime } from "@/lib/user-preferences";

export type ArrivalRequest = {
  id: string;
  reservation_id: string | null;
  guest_id: string | null;
  room_number: string;
  request_type: "arrival_eta" | "early_checkin";
  eta: string | null;
  requested_time: string | null;
  details: Record<string, unknown> | null;
  status: string;
  created_at: string;
  guests: { name: string; phone: string | null } | null;
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

function matchesArrivalRequest(request: ArrivalRequest, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  return [
    request.room_number,
    request.status,
    request.guests?.name,
    requestLabels[request.request_type],
    request.eta,
    request.requested_time,
    request.reservations?.check_in_date,
    getDetailText(request),
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

export function ArrivalRequestsTable({
  initialData,
}: {
  initialData: ArrivalRequest[];
}) {
  const [requests, setRequests] = useState<ArrivalRequest[]>(initialData);
  const [query, setQuery] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const preferences = useUserPreferences();
  const supabase = createClient();

  const filteredRequests = useMemo(
    () => requests.filter((request) => matchesArrivalRequest(request, query)),
    [requests, query],
  );

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
        <Stack gap="sm" align="center">
          <ThemeIcon size={48} radius="xl" variant="light" color="gray">
            <IconDoorEnter size={24} />
          </ThemeIcon>
          <Text fw={600}>No arrival requests</Text>
          <Text size="sm" c="dimmed" maw={420}>
            Pre-arrival ETA and early check-in requests will appear here after
            guests share arrival plans through WhatsApp.
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Text fw={600}>Arrival request queue</Text>
          <Text size="sm" c="dimmed">
            Search arrival requests by guest, room, request type, status, or notes.
          </Text>
        </Stack>

        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search arrival requests"
          leftSection={<IconSearch size={16} />}
          w={{ base: "100%", sm: 280 }}
        />
      </Group>

      {filteredRequests.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack gap="sm" align="center">
            <ThemeIcon size={44} radius="xl" variant="light" color="blue">
              <IconSearch size={20} />
            </ThemeIcon>
            <Text fw={600}>No arrival requests match your search</Text>
            <Text size="sm" c="dimmed">
              Try another guest name, room number, request type, status, or note.
            </Text>
          </Stack>
        </Paper>
      ) : (
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
        {filteredRequests.map((request) => (
          <Table.Tr key={request.id}>
            <Table.Td>
              <Text size="sm">
                {formatUserTime(request.created_at, preferences)}
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
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<IconMessageCircle size={14} />}
                  onClick={() => setSelectedRequestId(request.id)}
                >
                  Detail
                </Button>
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
      )}
      <OperationChatDrawer
        opened={Boolean(selectedRequestId)}
        operationType="arrival-requests"
        operationId={selectedRequestId}
        onClose={() => setSelectedRequestId(null)}
      />
    </Stack>
  );
}
