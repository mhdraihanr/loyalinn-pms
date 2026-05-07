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
import { IconSearch, IconToolsKitchen2 } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { updateRoomServiceStatus } from "@/lib/actions/operations";

type RoomServiceItem = {
  name: string;
  quantity: number;
  notes?: string;
};

export type RoomServiceOrder = {
  id: string;
  room_number: string;
  items: RoomServiceItem[];
  total_amount: number;
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

const ROOM_SERVICE_TYPE_LABEL = "Room Service";
const ROOM_SERVICE_TYPE_COLOR = "pink";

function matchesRoomServiceOrder(order: RoomServiceOrder, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  const itemValues =
    order.items?.flatMap((item) => [item.name, item.notes]) ?? [];

  return [
    order.room_number,
    ROOM_SERVICE_TYPE_LABEL,
    order.status,
    order.guests?.name,
    order.total_amount?.toString(),
    ...itemValues,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

export function RoomServiceTable({
  initialData,
}: {
  initialData: RoomServiceOrder[];
}) {
  const [orders, setOrders] = useState<RoomServiceOrder[]>(initialData);
  const [query, setQuery] = useState("");
  const supabase = createClient();

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesRoomServiceOrder(order, query)),
    [orders, query],
  );

  useEffect(() => {
    const channel = supabase
      .channel("room-service-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_service_orders",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newOrder = payload.new as RoomServiceOrder;
            setOrders((prev) => [newOrder, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setOrders((prev) =>
              prev.map((order) =>
                order.id === payload.new.id
                  ? { ...order, ...payload.new }
                  : order,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setOrders((prev) =>
              prev.filter((order) => order.id !== payload.old.id),
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
    setOrders((prev) =>
      prev.map((order) =>
        order.id === id ? { ...order, status: newStatus } : order,
      ),
    );
    await updateRoomServiceStatus(id, newStatus);
  };

  if (orders.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Stack gap="sm" align="center">
          <ThemeIcon size={48} radius="xl" variant="light" color="gray">
            <IconToolsKitchen2 size={24} />
          </ThemeIcon>
          <Text fw={600}>No room service orders</Text>
          <Text size="sm" c="dimmed" maw={420}>
            AI-generated room service orders will appear here when guests place
            in-room dining requests.
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Text fw={600}>Room service queue</Text>
          <Text size="sm" c="dimmed">
            Search room service by guest, room, item, note, status, or amount.
          </Text>
        </Stack>

        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search room service"
          leftSection={<IconSearch size={16} />}
          w={{ base: "100%", sm: 280 }}
        />
      </Group>

      {filteredOrders.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack gap="sm" align="center">
            <ThemeIcon size={44} radius="xl" variant="light" color="blue">
              <IconSearch size={20} />
            </ThemeIcon>
            <Text fw={600}>No room service orders match your search</Text>
            <Text size="sm" c="dimmed">
              Try another guest name, room number, item, note, or status term.
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
              <Table.Th>Items</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredOrders.map((order) => (
              <Table.Tr key={order.id}>
                <Table.Td>
                  <Text size="sm">
                    {new Date(order.created_at).toLocaleTimeString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {order.room_number}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {order.guests?.name || "Unknown"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={ROOM_SERVICE_TYPE_COLOR} variant="light">
                    {ROOM_SERVICE_TYPE_LABEL}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Stack gap={0}>
                    {order.items?.map((item, idx) => (
                      <Text key={idx} size="sm">
                        {item.quantity}x {item.name}{" "}
                        {item.notes ? `(${item.notes})` : ""}
                      </Text>
                    ))}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={statusColors[order.status] || "gray"}
                    variant="light"
                  >
                    {order.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {order.status === "pending" && (
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() =>
                          handleStatusChange(order.id, "in-progress")
                        }
                      >
                        Start
                      </Button>
                    )}
                    {order.status === "in-progress" && (
                      <Button
                        size="xs"
                        color="green"
                        onClick={() =>
                          handleStatusChange(order.id, "completed")
                        }
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
