"use client";

import { Table, Text, Badge, Avatar, Group, Box, Stack } from "@mantine/core";

type Guest = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  tier: string | null;
  loyalty_points: number | null;
  created_at: string | null;
};

const tierColors: Record<string, string> = {
  bronze: "orange",
  silver: "gray",
  gold: "yellow",
  platinum: "cyan",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function GuestsTable({ guests }: { guests: Guest[] }) {
  if (guests.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Stack gap="xs" align="center">
          <Text c="dimmed" fw={500}>
            No guests yet
          </Text>
          <Text size="sm" c="dimmed">
            Guests will appear here after you connect a PMS and sync
            reservations.
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>Phone</Table.Th>
          <Table.Th>Email</Table.Th>
          <Table.Th>Country</Table.Th>
          <Table.Th>Tier</Table.Th>
          <Table.Th>Points</Table.Th>
          <Table.Th>Joined</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {guests.map((guest) => (
          <Table.Tr key={guest.id}>
            <Table.Td>
              <Group gap="sm">
                <Avatar size={32} radius="xl" color="blue">
                  {getInitials(guest.full_name)}
                </Avatar>
                <Text size="sm" fw={500}>
                  {guest.full_name ?? "—"}
                </Text>
              </Group>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c={guest.phone ? undefined : "dimmed"}>
                {guest.phone ?? "—"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c={guest.email ? undefined : "dimmed"}>
                {guest.email ?? "—"}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c={guest.country ? undefined : "dimmed"}>
                {guest.country ?? "—"}
              </Text>
            </Table.Td>
            <Table.Td>
              {guest.tier ? (
                <Badge
                  color={tierColors[guest.tier.toLowerCase()] ?? "blue"}
                  variant="light"
                  radius="sm"
                  tt="capitalize"
                >
                  {guest.tier}
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  —
                </Text>
              )}
            </Table.Td>
            <Table.Td>
              <Text size="sm">{guest.loyalty_points ?? 0}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed">
                {formatDate(guest.created_at)}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
