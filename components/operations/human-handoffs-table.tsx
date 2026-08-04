"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Group, Paper, Stack, Table, Text, TextInput, ThemeIcon } from "@mantine/core";
import { IconMessageCircle, IconSearch, IconUsers } from "@tabler/icons-react";
import { refreshHandoffChat } from "@/lib/actions/operations";
import type { HumanHandoff } from "@/lib/data/operations";

type HumanHandoffsTableProps = {
  initialData: HumanHandoff[];
};

const HANDOFF_REASON_LABELS: Record<string, string> = {
  out_of_stage_request: "Permintaan di luar tahap tamu",
  clarification_limit_reached: "Pesan masih belum jelas",
  guest_requested_human: "Tamu meminta bantuan staf",
  requires_staff_judgment: "Memerlukan keputusan staf",
  unsupported_or_out_of_topic_request: "Permintaan di luar cakupan otomatis",
  high_priority_safety_or_medical: "Keamanan atau bantuan darurat",
  provider_unavailable: "Asisten otomatis tidak tersedia",
};

function getHandoffReasonLabel(handoff: HumanHandoff) {
  const reason = handoff.handoff_reason;

  if (reason && HANDOFF_REASON_LABELS[reason]) {
    return HANDOFF_REASON_LABELS[reason];
  }

  if (handoff.last_action_type === "provider_fallback_handoff") {
    return "Asisten otomatis tidak tersedia";
  }

  if (handoff.last_action_type === "completed_post_stay_handoff_notified") {
    return "Tindak lanjut setelah feedback";
  }

  if (handoff.last_action_type === "escalate_to_human") {
    return "Memerlukan peninjauan staf";
  }

  return "Memerlukan peninjauan staf";
}

export function HumanHandoffsTable({ initialData }: HumanHandoffsTableProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return initialData;

    return initialData.filter((handoff) =>
      [
        handoff.guests?.name,
        handoff.guests?.phone,
        handoff.reservations?.room_number,
        handoff.lifecycle_stage,
        handoff.handoff_reason,
        handoff.last_action_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [initialData, query]);

  const open = (handoff: HumanHandoff) => {
    setOpeningId(handoff.id);
    startTransition(async () => {
      await refreshHandoffChat(handoff.id);
      router.push(`/operations?tab=human-handoffs&handoff=${handoff.id}`);
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Text fw={600}>Human Handoffs</Text>
          <Text size="sm" c="dimmed">Permintaan yang memerlukan peninjauan staf sebelum ditangani.</Text>
        </Stack>
        <TextInput
          w={{ base: "100%", sm: 300 }}
          placeholder="Cari guest, room, atau alasan"
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </Group>

      {rows.length === 0 ? (
        <Paper withBorder p="xl" radius="md">
          <Stack align="center" gap="xs">
            <ThemeIcon size="lg" radius="xl" variant="light" color="gray"><IconUsers size={20} /></ThemeIcon>
            <Text fw={600}>{query ? "Tidak ada handoff yang cocok" : "Tidak ada handoff aktif"}</Text>
            <Text size="sm" c="dimmed" ta="center">Handoff dari lifecycle AI akan muncul di sini ketika membutuhkan review staf.</Text>
          </Stack>
        </Paper>
      ) : (
        <Table.ScrollContainer minWidth={820}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Guest</Table.Th>
                <Table.Th>Room</Table.Th>
                <Table.Th>Stage</Table.Th>
                <Table.Th>Reason</Table.Th>
                <Table.Th>Last inbound</Table.Th>
                <Table.Th ta="right">Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((handoff) => (
                <Table.Tr key={handoff.id}>
                  <Table.Td>
                    <Text fw={600} size="sm">{handoff.guests?.name ?? "Guest"}</Text>
                    <Text size="xs" c="dimmed">{handoff.guests?.phone ?? "-"}</Text>
                  </Table.Td>
                  <Table.Td>{handoff.reservations?.room_number ?? "-"}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Badge size="sm" variant="light">{handoff.lifecycle_stage}</Badge>
                      {handoff.handoff_priority === "high" ? <Badge size="sm" color="red">high</Badge> : null}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{getHandoffReasonLabel(handoff)}</Text>
                    {handoff.last_refresh_error ? <Text size="xs" c="orange">Transcript database fallback</Text> : null}
                  </Table.Td>
                  <Table.Td><Text size="sm">{handoff.last_inbound_message_at ? new Date(handoff.last_inbound_message_at).toLocaleString() : "-"}</Text></Table.Td>
                  <Table.Td ta="right">
                    <Button
                      size="xs"
                      leftSection={<IconMessageCircle size={14} />}
                      loading={isPending && openingId === handoff.id}
                      onClick={() => open(handoff)}
                    >
                      Open chat
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
