"use client";

import { useMemo, useState } from "react";
import {
  Avatar,
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
import { IconSearch, IconUsers } from "@tabler/icons-react";
import { useUserPreferences } from "@/components/settings/profile/use-user-preferences";
import { formatUserDate } from "@/lib/user-preferences";

type Guest = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  tier: string | null;
  points: number | null;
  created_at: string | null;
};

const tierColors: Record<string, string> = {
  bronze: "orange",
  silver: "gray",
  gold: "yellow",
  platinum: "cyan",
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function matchesGuest(guest: Guest, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return true;

  return [guest.name, guest.email, guest.phone, guest.country]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}

export function GuestsTable({ guests }: { guests: Guest[] }) {
  const [query, setQuery] = useState("");
  const preferences = useUserPreferences();

  const filteredGuests = useMemo(
    () => guests.filter((guest) => matchesGuest(guest, query)),
    [guests, query],
  );

  if (guests.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Stack gap="sm" align="center">
          <ThemeIcon size={48} radius="xl" variant="light" color="gray">
            <IconUsers size={24} />
          </ThemeIcon>
          <Text fw={600}>No guests yet</Text>
          <Text size="sm" c="dimmed" maw={420}>
            Guests will appear here after you connect a PMS and sync
            reservations.
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Text fw={600}>Guest directory</Text>
          <Text size="sm" c="dimmed">
            Search guests by name, email, phone, or country.
          </Text>
        </Stack>

        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search guests"
          leftSection={<IconSearch size={16} />}
          w={{ base: "100%", sm: 280 }}
        />
      </Group>

      {filteredGuests.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack gap="sm" align="center">
            <ThemeIcon size={44} radius="xl" variant="light" color="blue">
              <IconSearch size={20} />
            </ThemeIcon>
            <Text fw={600}>No guests match your search</Text>
            <Text size="sm" c="dimmed">
              Try a different name, email, phone number, or country keyword.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Table highlightOnHover verticalSpacing="md">
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
            {filteredGuests.map((guest) => (
              <Table.Tr key={guest.id}>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar size={40} radius="xl" color="blue">
                      {getInitials(guest.name)}
                    </Avatar>
                    <Stack gap={1}>
                      <Text size="sm" fw={600}>
                        {guest.name ?? "—"}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Guest profile
                      </Text>
                    </Stack>
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
                  <Text size="sm" fw={600}>
                    {(guest.points ?? 0).toLocaleString("en-US")}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatUserDate(guest.created_at, preferences)}
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
