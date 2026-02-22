"use client";

import { Table, Text, Badge, Box } from "@mantine/core";

const statusColors: Record<string, string> = {
  "pre-arrival": "blue",
  "on-stay": "green",
  "checked-out": "gray",
  cancelled: "red",
};

export function RecentReservationsTable({
  reservations,
}: {
  reservations: any[];
}) {
  if (reservations.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Text c="dimmed" size="sm">
          No reservations yet. Connect a PMS to start syncing data.
        </Text>
      </Box>
    );
  }

  return (
    <Table highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Guest</Table.Th>
          <Table.Th>Room</Table.Th>
          <Table.Th>Check-in</Table.Th>
          <Table.Th>Check-out</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {reservations.map((r) => (
          <Table.Tr key={r.id}>
            <Table.Td>{r.guest_name ?? "—"}</Table.Td>
            <Table.Td>{r.room_number ?? "—"}</Table.Td>
            <Table.Td>{r.check_in_date ?? "—"}</Table.Td>
            <Table.Td>{r.check_out_date ?? "—"}</Table.Td>
            <Table.Td>
              <Badge
                color={statusColors[r.status] ?? "gray"}
                radius="sm"
                variant="light"
              >
                {r.status}
              </Badge>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
