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
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { IconAlertTriangle, IconRefresh, IconSend, IconX } from "@tabler/icons-react";
import {
  refreshHandoffChat,
  resolveHumanHandoff,
  sendManualHandoffReply,
} from "@/lib/actions/operations";
import type { HandoffTranscriptMessage, HumanHandoff } from "@/lib/data/operations";

type HandoffChatDrawerProps = {
  handoff: HumanHandoff | null;
  transcript: HandoffTranscriptMessage[];
};

export function HandoffChatDrawer({ handoff, transcript }: HandoffChatDrawerProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const viewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handoffId = handoff?.id;
  const latestMessageId = transcript.at(-1)?.id;

  const scrollToLatestMessage = useCallback((behavior: ScrollBehavior = "auto") => {
    requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    });
  }, []);

  useEffect(() => {
    if (!handoffId) return;

    scrollToLatestMessage();
    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
      scrollToLatestMessage();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [handoffId, scrollToLatestMessage]);

  useEffect(() => {
    if (!handoffId) return;

    scrollToLatestMessage("smooth");
  }, [handoffId, latestMessageId, scrollToLatestMessage]);

  const close = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("handoff");
    params.set("tab", "human-handoffs");
    router.push(`/operations?${params.toString()}`);
  };

  const refresh = () => {
    if (!handoff) return;
    setNotice(null);
    startTransition(async () => {
      const result = await refreshHandoffChat(handoff.id);
      setNotice(
        result.success
          ? `Chat WAHA diperbarui (${result.messageCount ?? 0} pesan ditemukan).`
          : result.error ?? "Menampilkan transcript database.",
      );
      router.refresh();
    });
  };

  const send = () => {
    if (!handoff || !content.trim()) return;
    setNotice(null);
    startTransition(async () => {
      const result = await sendManualHandoffReply(
        handoff.id,
        content,
        handoff.handoff_version,
      );
      if (result.success) {
        setContent("");
        setNotice("Pesan manual berhasil dikirim.");
        scrollToLatestMessage("smooth");
        router.refresh();
        window.setTimeout(() => textareaRef.current?.focus(), 150);
      } else {
        setNotice(result.error ?? "Gagal mengirim pesan.");
      }
    });
  };

  const resolve = () => {
    if (!handoff) return;
    setNotice(null);
    startTransition(async () => {
      const result = await resolveHumanHandoff(
        handoff.id,
        handoff.handoff_version,
      );
      if (result.success) {
        close();
        router.refresh();
      } else {
        setNotice(result.error ?? "Gagal menyelesaikan handoff.");
      }
    });
  };

  return (
    <Drawer
      opened={Boolean(handoff)}
      onClose={close}
      position="right"
      size="md"
      title={handoff ? `Chat: ${handoff.guests?.name ?? "Guest"}` : "Human handoff"}
      styles={{
        body: {
          height: "calc(100dvh - 60px)",
          display: "flex",
          flexDirection: "column",
          padding: "var(--mantine-spacing-md)",
        },
      }}
    >
      {handoff ? (
        <Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
          <Group justify="space-between" gap="xs">
            <Group gap={4}>
              <Badge size="xs" color="violet">{handoff.lifecycle_stage}</Badge>
              <Badge size="xs" color={handoff.handoff_priority === "high" ? "red" : "gray"}>
                {handoff.handoff_priority}
              </Badge>
              <Badge size="xs" color="orange">handoff</Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Room {handoff.reservations?.room_number ?? "-"}
            </Text>
          </Group>

          <Text size="xs" c="dimmed">
            {handoff.guests?.phone ?? "Nomor tamu tidak tersedia"}
            {handoff.handoff_reason || handoff.last_action_type
              ? ` · ${handoff.handoff_reason ?? handoff.last_action_type}`
              : ""}
          </Text>

          {notice ? (
            <Alert
              color={notice.includes("gagal") || notice.includes("database") ? "yellow" : "green"}
              icon={<IconAlertTriangle size={14} />}
              py="xs"
            >
              <Text size="xs">{notice}</Text>
            </Alert>
          ) : null}

          <Group justify="space-between" gap="xs">
            <Button
              size="xs"
              leftSection={<IconRefresh size={14} />}
              variant="subtle"
              onClick={refresh}
              loading={isPending}
            >
              Refresh chat
            </Button>
            <Text size="xs" c="dimmed">
              {handoff.last_refreshed_at
                ? `Diperbarui ${new Date(handoff.last_refreshed_at).toLocaleString()}`
                : "Belum ada refresh WAHA"}
            </Text>
          </Group>

          <Divider />

          <ScrollArea
            viewportRef={viewportRef}
            offsetScrollbars
            style={{ flex: 1, minHeight: 0 }}
          >
            <Stack gap="xs" pr="xs">
              {transcript.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  Belum ada transcript tersimpan.
                </Text>
              ) : (
                transcript.map((message) => {
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
                })
              )}
            </Stack>
          </ScrollArea>

          <Textarea
            ref={textareaRef}
            aria-label="Balas manual"
            placeholder="Tulis balasan untuk tamu..."
            value={content}
            onChange={(event) => setContent(event.currentTarget.value)}
            autosize
            minRows={1}
            maxRows={4}
            disabled={isPending}
          />
          <Group justify="space-between">
            <Button
              size="xs"
              color="red"
              variant="subtle"
              leftSection={<IconX size={14} />}
              onClick={resolve}
              loading={isPending}
            >
              Resolve handoff
            </Button>
            <Button
              size="sm"
              leftSection={<IconSend size={14} />}
              onClick={send}
              loading={isPending}
              disabled={!content.trim()}
            >
              Kirim WhatsApp
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Drawer>
  );
}
