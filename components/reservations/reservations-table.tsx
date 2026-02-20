"use client";

import { Table, Text, Badge, Box, Stack } from "@mantine/core";

export type ReservationWithGuest = {
  id: string;
  pms_reservation_id: string | null;
  room_number: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  amount: number | null;
  source: string | null;
  created_at: string;
  guests: {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

const statusColors: Record<string, string> = {
  "pre-arrival": "blue",
  "on-stay": "green",
  "checked-out": "gray",
  cancelled: "red",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function ReservationsTable({
  reservations,
}: {
  reservations: ReservationWithGuest[];
}) {
  if (reservations.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Stack gap="xs" align="center">
          <Text c="dimmed" fw={500}>
            No reservations found
          </Text>
          <Text size="sm" c="dimmed">
            Reservations will appear here after you connect a PMS and sync data.
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Guest</Table.Th>
          <Table.Th>Dates</Table.Th>
          <Table.Th>Room</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Amount</Table.Th>
          <Table.Th>Source</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {reservations.map((res) => (
          <Table.Tr key={res.id}>
            <Table.Td>
              <Stack gap={0}>
                <Text size="sm" fw={500}>
                  {res.guests?.name ?? "Unknown Guest"}
                </Text>
                <Text size="xs" c="dimmed">
                  {res.guests?.email ?? res.guests?.phone ?? "No contact info"}
                </Text>
              </Stack>
            </Table.Td>
            <Table.Td>
              <Stack gap={0}>
                <Text size="sm">{formatDate(res.check_in_date)}</Text>
                <Text size="xs" c="dimmed">
                  to {formatDate(res.check_out_date)}
                </Text>
              </Stack>
            </Table.Td>
            <Table.Td>
              <Text size="sm" fw={500}>
                {res.room_number ?? "—"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Badge
                color={statusColors[res.status.toLowerCase()] ?? "gray"}
                variant="light"
                radius="sm"
                tt="capitalize"
              >
                {res.status.replace("-", " ")}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{formatCurrency(res.amount)}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c={res.source ? undefined : "dimmed"}>
                {res.source ?? "—"}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
