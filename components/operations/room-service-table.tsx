"use client";

import { useEffect, useState } from "react";
import { Table, Text, Badge, Box, Group, Button, Stack } from "@mantine/core";
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

export function RoomServiceTable({
  initialData,
}: {
  initialData: RoomServiceOrder[];
}) {
  const [orders, setOrders] = useState<RoomServiceOrder[]>(initialData);
  const supabase = createClient();

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
                  : order
              )
            );
          } else if (payload.eventType === "DELETE") {
            setOrders((prev) => prev.filter((order) => order.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleStatusChange = async (id: string, newStatus: "in-progress" | "completed") => {
    setOrders((prev) =>
      prev.map((order) => (order.id === id ? { ...order, status: newStatus } : order))
    );
    await updateRoomServiceStatus(id, newStatus);
  };

  if (orders.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Text c="dimmed">No pending room service orders.</Text>
      </Box>
    );
  }

  return (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Time</Table.Th>
          <Table.Th>Room</Table.Th>
          <Table.Th>Items</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {orders.map((order) => (
          <Table.Tr key={order.id}>
            <Table.Td>
              <Text size="sm">{new Date(order.created_at).toLocaleTimeString()}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>{order.room_number}</Text>
              <Text size="xs" c="dimmed">{order.guests?.name || "Unknown"}</Text>
            </Table.Td>
            <Table.Td>
              <Stack gap={0}>
                {order.items?.map((item, idx) => (
                  <Text key={idx} size="sm">
                    {item.quantity}x {item.name} {item.notes ? `(${item.notes})` : ""}
                  </Text>
                ))}
              </Stack>
            </Table.Td>
            <Table.Td>
              <Badge color={statusColors[order.status] || "gray"} variant="light">
                {order.status}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Group gap="xs">
                {order.status === "pending" && (
                  <Button size="xs" variant="light" onClick={() => handleStatusChange(order.id, "in-progress")}>
                    Start
                  </Button>
                )}
                {order.status === "in-progress" && (
                  <Button size="xs" color="green" onClick={() => handleStatusChange(order.id, "completed")}>
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
