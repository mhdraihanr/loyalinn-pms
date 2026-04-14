"use client";

import { useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Group,
  Modal,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { IconEye } from "@tabler/icons-react";

import type { FeedbackMonitorRow } from "@/lib/data/feedback";

const statusColorMap: Record<FeedbackMonitorRow["feedbackStatus"], string> = {
  "not-sent": "gray",
  pending: "yellow",
  ai_followup: "blue",
  completed: "green",
  ignored: "red",
};

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: FeedbackMonitorRow["feedbackStatus"]) {
  if (status === "ai_followup") {
    return "AI Follow-up";
  }

  return status.replace("-", " ");
}

export function FeedbackMonitorTable({ rows }: { rows: FeedbackMonitorRow[] }) {
  const [selectedRow, setSelectedRow] = useState<FeedbackMonitorRow | null>(
    null,
  );

  if (rows.length === 0) {
    return (
      <Box py="xl" ta="center">
        <Stack gap="xs" align="center">
          <Text c="dimmed" fw={500}>
            Belum ada data feedback.
          </Text>
          <Text size="sm" c="dimmed">
            Data akan muncul setelah reservasi checked-out dan flow post-stay
            berjalan.
          </Text>
        </Stack>
      </Box>
    );
  }

  return (
    <>
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Guest</Table.Th>
            <Table.Th>Check-out</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Rating</Table.Th>
            <Table.Th>Comments</Table.Th>
            <Table.Th>Last Update</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>
                <Stack gap={0}>
                  <Text size="sm" fw={500}>
                    {row.guestName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {row.guestPhone ?? "No phone"}
                  </Text>
                </Stack>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{formatDate(row.checkOutDate)}</Text>
              </Table.Td>
              <Table.Td>
                <Badge
                  color={statusColorMap[row.feedbackStatus]}
                  variant="light"
                  radius="sm"
                  tt="capitalize"
                >
                  {statusLabel(row.feedbackStatus)}
                </Badge>
              </Table.Td>
              <Table.Td>
                {row.rating ? (
                  <Group gap={4}>
                    <Text size="sm" fw={600}>
                      {row.rating}
                    </Text>
                    <Text size="xs" c="dimmed">
                      / 5
                    </Text>
                  </Group>
                ) : (
                  <Text size="sm" c="dimmed">
                    -
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm" lineClamp={2} maw={320}>
                  {row.comments ?? "-"}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{formatDateTime(row.updatedAt)}</Text>
              </Table.Td>
              <Table.Td>
                <ActionIcon
                  variant="light"
                  color="blue"
                  aria-label="View feedback detail"
                  onClick={() => setSelectedRow(row)}
                >
                  <IconEye size={16} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal
        opened={Boolean(selectedRow)}
        onClose={() => setSelectedRow(null)}
        title="Feedback Detail"
        centered
        size="lg"
      >
        {selectedRow ? (
          <Stack gap="md">
            <Group justify="space-between" align="start">
              <Stack gap={0}>
                <Text fw={600}>{selectedRow.guestName}</Text>
                <Text size="sm" c="dimmed">
                  {selectedRow.guestPhone ?? "No phone"}
                </Text>
              </Stack>
              <Badge
                color={statusColorMap[selectedRow.feedbackStatus]}
                variant="light"
              >
                {statusLabel(selectedRow.feedbackStatus)}
              </Badge>
            </Group>

            <Group gap="xl">
              <Stack gap={0}>
                <Text size="xs" c="dimmed">
                  Rating
                </Text>
                <Text fw={600}>{selectedRow.rating ?? "-"}</Text>
              </Stack>
              <Stack gap={0}>
                <Text size="xs" c="dimmed">
                  Check-out
                </Text>
                <Text fw={600}>{formatDate(selectedRow.checkOutDate)}</Text>
              </Stack>
            </Group>

            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                Full Comment
              </Text>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {selectedRow.comments ?? "-"}
              </Text>
            </Stack>

            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                Feedback Link
              </Text>
              {selectedRow.feedbackLink ? (
                <>
                  <Anchor href={selectedRow.feedbackLink} target="_blank">
                    Open feedback link
                  </Anchor>
                  <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                    {selectedRow.feedbackLink}
                  </Text>
                </>
              ) : (
                <Text size="sm" c="dimmed">
                  Link not available
                </Text>
              )}
            </Stack>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
