"use client";

import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  CopyButton,
  Divider,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconCheck,
  IconCopy,
  IconEye,
  IconExternalLink,
  IconGift,
  IconMessageCircle,
  IconStar,
} from "@tabler/icons-react";

import type { FeedbackMonitorRow } from "@/lib/data/feedback";

const statusColorMap: Record<FeedbackMonitorRow["feedbackStatus"], string> = {
  "not-sent": "gray",
  pending: "yellow",
  ai_followup: "blue",
  completed: "green",
  ignored: "red",
};

const FEEDBACK_REWARD_POINTS = 50;

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
          <Stack gap="lg">
            <Card withBorder radius="md" padding="md">
              <Group justify="space-between" align="start" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={700} size="lg">
                    {selectedRow.guestName}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {selectedRow.guestPhone ?? "No phone"}
                  </Text>
                </Stack>

                <Stack gap="xs" align="end">
                  <Badge
                    color={statusColorMap[selectedRow.feedbackStatus]}
                    variant="light"
                  >
                    {statusLabel(selectedRow.feedbackStatus)}
                  </Badge>
                  {selectedRow.feedbackStatus === "completed" ? (
                    <Badge
                      leftSection={<IconGift size={12} />}
                      color="teal"
                      variant="light"
                    >
                      +{FEEDBACK_REWARD_POINTS} Points
                    </Badge>
                  ) : null}
                </Stack>
              </Group>
            </Card>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Paper withBorder radius="md" p="sm">
                <Group gap="xs" mb={4}>
                  <ThemeIcon variant="light" color="yellow" size="sm">
                    <IconStar size={12} />
                  </ThemeIcon>
                  <Text size="xs" c="dimmed">
                    Rating
                  </Text>
                </Group>
                <Text fw={700} size="lg">
                  {selectedRow.rating ?? "-"}
                  {selectedRow.rating ? (
                    <Text component="span" size="sm" c="dimmed" ml={4}>
                      / 5
                    </Text>
                  ) : null}
                </Text>
              </Paper>

              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed" mb={4}>
                  Check-out
                </Text>
                <Text fw={600}>{formatDate(selectedRow.checkOutDate)}</Text>
              </Paper>

              <Paper withBorder radius="md" p="sm">
                <Text size="xs" c="dimmed" mb={4}>
                  Last Update
                </Text>
                <Text fw={600}>{formatDateTime(selectedRow.updatedAt)}</Text>
              </Paper>
            </SimpleGrid>

            <Divider />

            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon variant="light" color="blue" size="sm">
                  <IconMessageCircle size={12} />
                </ThemeIcon>
                <Text size="sm" fw={600}>
                  Full Comment
                </Text>
              </Group>

              <Paper withBorder radius="md" p="sm" bg="gray.0">
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                  {selectedRow.comments ?? "-"}
                </Text>
              </Paper>
            </Stack>

            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Feedback Link
              </Text>

              {selectedRow.feedbackLink ? (
                <>
                  <Group gap="xs">
                    <Button
                      component="a"
                      href={selectedRow.feedbackLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="light"
                      size="xs"
                      leftSection={<IconExternalLink size={14} />}
                    >
                      Open Link
                    </Button>

                    <CopyButton value={selectedRow.feedbackLink} timeout={1500}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? "Copied" : "Copy link"}>
                          <ActionIcon
                            variant="light"
                            color={copied ? "teal" : "gray"}
                            onClick={copy}
                            aria-label="Copy feedback link"
                          >
                            {copied ? (
                              <IconCheck size={14} />
                            ) : (
                              <IconCopy size={14} />
                            )}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>

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
