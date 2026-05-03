"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { IconBed, IconSearch } from "@tabler/icons-react";

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

function matchesReservation(reservation: ReservationWithGuest, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  return [reservation.guests?.name, reservation.room_number, reservation.source]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

export function ReservationsTable({
  reservations,
}: {
  reservations: ReservationWithGuest[];
}) {
  const [query, setQuery] = useState("");

  const filteredReservations = useMemo(
    () =>
      reservations.filter((reservation) =>
        matchesReservation(reservation, query),
      ),
    [reservations, query],
  );

  if (reservations.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Stack gap="sm" align="center">
          <ThemeIcon size={48} radius="xl" variant="light" color="gray">
            <IconBed size={24} />
          </ThemeIcon>
          <Text fw={600}>No reservations found</Text>
          <Text size="sm" c="dimmed" maw={420}>
            Reservation data will appear here after your PMS sync completes.
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Text fw={600}>Reservation list</Text>
          <Text size="sm" c="dimmed">
            Search reservations by guest, room number, or booking source.
          </Text>
        </Stack>

        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search reservations"
          leftSection={<IconSearch size={16} />}
          w={{ base: "100%", sm: 280 }}
        />
      </Group>

      {filteredReservations.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack gap="sm" align="center">
            <ThemeIcon size={44} radius="xl" variant="light" color="blue">
              <IconSearch size={20} />
            </ThemeIcon>
            <Text fw={600}>No reservations match your search</Text>
            <Text size="sm" c="dimmed">
              Try another guest name, room number, or booking source term.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Table highlightOnHover verticalSpacing="md">
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
            {filteredReservations.map((reservation) => (
              <Table.Tr key={reservation.id}>
                <Table.Td>
                  <Stack gap={1}>
                    <Text size="sm" fw={600}>
                      {reservation.guests?.name ?? "—"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {reservation.guests?.email ??
                        reservation.guests?.phone ??
                        "No contact info"}
                    </Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Stack gap={1}>
                    <Text size="sm" fw={500}>
                      {formatDate(reservation.check_in_date)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      to {formatDate(reservation.check_out_date)}
                    </Text>
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={600}>
                    {reservation.room_number ?? "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={statusColors[reservation.status] ?? "gray"}
                    variant="light"
                    radius="sm"
                  >
                    {reservation.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={700}>
                    {formatCurrency(reservation.amount)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={reservation.source ? undefined : "dimmed"}>
                    {reservation.source ?? "Direct"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
