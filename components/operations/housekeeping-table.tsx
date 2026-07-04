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
import { IconBed, IconSearch } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { updateHousekeepingStatus } from "@/lib/actions/operations";
import { useUserPreferences } from "@/components/settings/profile/use-user-preferences";
import { formatUserTime } from "@/lib/user-preferences";

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

const housekeepingTypeLabels: Record<string, string> = {
  cleaning: "Cleaning",
  towels: "Fresh Towels",
  amenities: "Amenities",
  laundry: "Laundry",
  turndown: "Turndown",
  maintenance: "Maintenance",
};

const housekeepingTypeColors: Record<string, string> = {
  cleaning: "blue",
  towels: "cyan",
  amenities: "grape",
  laundry: "indigo",
  turndown: "violet",
  maintenance: "orange",
};

function formatHousekeepingTypeLabel(requestType: string) {
  return (
    housekeepingTypeLabels[requestType] ??
    requestType
      .split(/[_-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatDetails(details: Record<string, unknown> | null): {
  description: string;
  extraItems: string[];
} {
  if (!details) return { description: "—", extraItems: [] };

  const description =
    typeof details.details === "string" ? details.details : "";

  const extraItems = Array.isArray(details.extra_items)
    ? (details.extra_items as string[]).filter(
        (item) => typeof item === "string" && item.trim() !== "",
      )
    : [];

  return { description: description || "—", extraItems };
}

function matchesHousekeepingRequest(
  request: HousekeepingRequest,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  const { description, extraItems } = formatDetails(request.details);

  return [
    request.room_number,
    request.request_type,
    formatHousekeepingTypeLabel(request.request_type),
    request.status,
    request.guests?.name,
    description,
    ...extraItems,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

export function HousekeepingTable({
  initialData,
}: {
  initialData: HousekeepingRequest[];
}) {
  const [requests, setRequests] = useState<HousekeepingRequest[]>(initialData);
  const [query, setQuery] = useState("");
  const preferences = useUserPreferences();
  const supabase = createClient();

  const filteredRequests = useMemo(
    () =>
      requests.filter((request) => matchesHousekeepingRequest(request, query)),
    [requests, query],
  );

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
                req.id === payload.new.id ? { ...req, ...payload.new } : req,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setRequests((prev) =>
              prev.filter((req) => req.id !== payload.old.id),
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
    newStatus: "in-progress" | "completed",
  ) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: newStatus } : req)),
    );
    await updateHousekeepingStatus(id, newStatus);
  };

  if (requests.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Stack gap="sm" align="center">
          <ThemeIcon size={48} radius="xl" variant="light" color="gray">
            <IconBed size={24} />
          </ThemeIcon>
          <Text fw={600}>No housekeeping requests</Text>
          <Text size="sm" c="dimmed" maw={420}>
            AI-generated housekeeping requests will appear here when guests ask
            for room cleaning, amenities, or support.
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Text fw={600}>Housekeeping queue</Text>
          <Text size="sm" c="dimmed">
            Search housekeeping by guest, room, type, status, or details.
          </Text>
        </Stack>

        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search housekeeping"
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
            <Text fw={600}>No housekeeping requests match your search</Text>
            <Text size="sm" c="dimmed">
              Try another guest name, room number, type, status, or detail term.
            </Text>
          </Stack>
        </Paper>
      ) : (
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
            {filteredRequests.map((req) => (
              <Table.Tr key={req.id}>
                <Table.Td>
                  <Text size="sm">
                    {formatUserTime(req.created_at, preferences)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {req.room_number}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {req.guests?.name || "Unknown"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={housekeepingTypeColors[req.request_type] || "gray"}
                    variant="light"
                  >
                    {formatHousekeepingTypeLabel(req.request_type)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {(() => {
                    const { description, extraItems } = formatDetails(
                      req.details,
                    );
                    return (
                      <Stack gap={2}>
                        <Text size="sm">{description}</Text>
                        {extraItems.length > 0 && (
                          <Group gap={4}>
                            {extraItems.map((item, idx) => (
                              <Badge
                                key={idx}
                                size="xs"
                                variant="outline"
                                color="gray"
                              >
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
                  <Badge
                    color={statusColors[req.status] || "gray"}
                    variant="light"
                  >
                    {req.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {req.status === "pending" && (
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() =>
                          handleStatusChange(req.id, "in-progress")
                        }
                      >
                        Start
                      </Button>
                    )}
                    {req.status === "in-progress" && (
                      <Button
                        size="xs"
                        color="green"
                        onClick={() => handleStatusChange(req.id, "completed")}
                      >
                        Complete
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
