"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { IconAlertTriangle, IconSend } from "@tabler/icons-react";
import {
  getOperationChatDetail,
  sendOperationChatReply,
  type OperationChatDetail,
  type OperationChatType,
} from "@/lib/actions/operations";

const OPERATION_TITLES: Record<OperationChatType, string> = {
  housekeeping: "Housekeeping",
  "room-service": "Room Service",
  "arrival-requests": "Arrival Request",
};

type OperationChatDrawerProps = {
  opened: boolean;
  operationType: OperationChatType;
  operationId: string | null;
  onClose: () => void;
};

export function OperationChatDrawer({
  opened,
  operationType,
  operationId,
  onClose,
}: OperationChatDrawerProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<OperationChatDetail | null>(null);
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const viewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const latestMessageId = detail?.messages.at(-1)?.id;

  const scrollToLatestMessage = useCallback((behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    });
  }, []);

  const loadDetail = useCallback(async () => {
    if (!opened || !operationId) return;

    setLoading(true);
    setNotice(null);
    const result = await getOperationChatDetail({ operationType, operationId });
    if (result.success) {
      setDetail(result.detail);
      window.setTimeout(() => {
        scrollToLatestMessage();
        textareaRef.current?.focus();
      }, 150);
    } else {
      setDetail(null);
      setNotice(result.error ?? "Gagal memuat detail chat.");
    }
    setLoading(false);
  }, [opened, operationId, operationType, scrollToLatestMessage]);

  useEffect(() => {
    if (!opened) return;

    const timer = window.setTimeout(() => {
      void loadDetail();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [opened, loadDetail]);

  useEffect(() => {
    if (!opened || !latestMessageId) return;
    scrollToLatestMessage("smooth");
  }, [opened, latestMessageId, scrollToLatestMessage]);

  const close = () => {
    setContent("");
    setNotice(null);
    setDetail(null);
    onClose();
  };

  const send = () => {
    if (!operationId || !content.trim()) return;

    setNotice(null);
    startTransition(async () => {
      const result = await sendOperationChatReply({
        operationType,
        operationId,
        content,
      });

      if (result.success) {
        setContent("");
        setNotice("Pesan manual berhasil dikirim.");
        await loadDetail();
        router.refresh();
        window.setTimeout(() => textareaRef.current?.focus(), 150);
      } else {
        setNotice(result.error ?? "Gagal mengirim pesan.");
        await loadDetail();
      }
    });
  };

  const title = detail
    ? `Chat: ${detail.guestName ?? "Guest"}`
    : `${OPERATION_TITLES[operationType]} Detail`;
  const disabledReason = detail?.replyDisabledReason;
  const sendingDisabled = !detail?.canReply || !content.trim() || isPending || loading;

  return (
    <Drawer
      opened={opened}
      onClose={close}
      position="right"
      size="lg"
      title={title}
      styles={{
        body: {
          height: "calc(100dvh - 60px)",
          display: "flex",
          flexDirection: "column",
          padding: "var(--mantine-spacing-md)",
        },
      }}
    >
      <Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
        {loading && !detail ? (
          <Stack align="center" justify="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">Memuat detail chat...</Text>
          </Stack>
        ) : null}

        {detail ? (
          <>
            <Group justify="space-between" gap="xs">
              <Group gap={4}>
                <Badge size="xs" color="blue">{detail.lifecycleStage}</Badge>
                <Badge size="xs" color="gray">{OPERATION_TITLES[detail.operationType]}</Badge>
                {detail.status ? <Badge size="xs" variant="light">{detail.status}</Badge> : null}
              </Group>
              <Text size="xs" c="dimmed">Room {detail.roomNumber ?? "-"}</Text>
            </Group>

            <Text size="sm" fw={600}>{detail.guestName ?? "Guest"}</Text>
            <Text size="xs" c="dimmed">{detail.guestPhone ?? "Nomor tamu tidak tersedia"}</Text>

            <Paper withBorder radius="md" p="xs">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                {detail.summary.map((item) => (
                  <Stack key={item.label} gap={0}>
                    <Text size="xs" c="dimmed">{item.label}</Text>
                    <Text size="sm" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {item.value}
                    </Text>
                  </Stack>
                ))}
              </SimpleGrid>
            </Paper>

            {detail.usedFallbackTranscript ? (
              <Alert color="yellow" icon={<IconAlertTriangle size={14} />} py="xs">
                <Text size="xs">Transcript stage ini kosong, jadi menampilkan seluruh chat reservasi.</Text>
              </Alert>
            ) : null}
          </>
        ) : null}

        {notice ? (
          <Alert
            color={notice.toLowerCase().includes("gagal") ? "yellow" : "green"}
            icon={<IconAlertTriangle size={14} />}
            py="xs"
          >
            <Text size="xs">{notice}</Text>
          </Alert>
        ) : null}

        {disabledReason ? (
          <Alert color="yellow" icon={<IconAlertTriangle size={14} />} py="xs">
            <Text size="xs">{disabledReason}</Text>
          </Alert>
        ) : null}

        <Divider />

        <ScrollArea viewportRef={viewportRef} offsetScrollbars style={{ flex: 1, minHeight: 0 }}>
          <Stack gap="xs" pr="xs">
            {detail && detail.messages.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                Belum ada transcript tersimpan.
              </Text>
            ) : null}

            {detail?.messages.map((message) => {
              const outbound = message.direction === "outbound";
              return (
                <Paper
                  key={message.id}
                  p="xs"
                  radius="sm"
                  bg={outbound ? "blue.0" : "gray.0"}
                  ml={outbound ? "lg" : 0}
                  mr={outbound ? 0 : "lg"}
                >
                  <Group justify="space-between" align="start" gap={4}>
                    <Text size="xs" fw={700}>
                      {outbound ? (message.source === "human" ? "Staff" : "Hotel") : "Guest"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(message.sent_at ?? message.created_at).toLocaleString()}
                    </Text>
                  </Group>
                  <Text size="sm" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {message.content}
                  </Text>
                  {message.status === "failed" ? <Text size="xs" c="red">Pesan gagal dikirim</Text> : null}
                </Paper>
              );
            })}
          </Stack>
        </ScrollArea>

        <Textarea
          ref={textareaRef}
          aria-label="Balas manual operasi"
          placeholder="Tulis balasan untuk tamu..."
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
          autosize
          minRows={1}
          maxRows={4}
          disabled={isPending || loading || !detail?.canReply}
        />
        <Group justify="flex-end">
          <Button
            size="sm"
            leftSection={<IconSend size={14} />}
            onClick={send}
            loading={isPending}
            disabled={sendingDisabled}
          >
            Kirim WhatsApp
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
