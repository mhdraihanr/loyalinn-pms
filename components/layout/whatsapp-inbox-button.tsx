"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconBrandWhatsapp,
  IconMessageCircle,
  IconRefresh,
  IconSend,
} from "@tabler/icons-react";

const CHAT_PAGE_LIMIT = 20;
const MESSAGE_LIMIT = 50;

type WahaStatusResponse = {
  status?: string;
  error?: string;
  me?: unknown;
};

type WahaRecord = Record<string, unknown>;

type WahaChatMessage = WahaRecord & {
  id?: unknown;
  timestamp?: number | string | null;
  fromMe?: boolean;
  from_me?: boolean;
  body?: unknown;
  text?: unknown;
  caption?: unknown;
  content?: unknown;
  _data?: WahaRecord;
};
type WahaChatOverview = WahaRecord & {
  id?: string;
  name?: string | null;
  picture?: string | null;
  lastMessage?: WahaChatMessage | null;
};

type ChatsResponse = {
  chats?: WahaChatOverview[];
  error?: string;
};

type MessagesResponse = {
  chatId?: string;
  messages?: WahaChatMessage[];
  error?: string;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getRecord(value: unknown): WahaRecord | null {
  return value && typeof value === "object" ? (value as WahaRecord) : null;
}

function extractMessageText(message: WahaChatMessage | null | undefined) {
  if (!message) return "";

  const direct = [message.body, message.text, message.caption, message.content]
    .map(getString)
    .find(Boolean);

  if (direct) return direct;

  const data = getRecord(message._data);
  if (!data) return "";

  return [data.body, data.text, data.caption, data.content]
    .map(getString)
    .find(Boolean) ?? "";
}

function extractTimestamp(value: unknown) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

  return new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);
}

function formatTime(value: unknown) {
  const date = extractTimestamp(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getChatId(chat: WahaChatOverview) {
  return getString(chat.id);
}

function getChatName(chat: WahaChatOverview) {
  const id = getChatId(chat);
  return getString(chat.name) || id.split("@")[0] || "Unknown chat";
}

function isFromMe(message: WahaChatMessage) {
  if (typeof message.fromMe === "boolean") return message.fromMe;
  if (typeof message.from_me === "boolean") return message.from_me;

  const data = getRecord(message._data);
  if (typeof data?.fromMe === "boolean") return data.fromMe;
  if (typeof data?.from_me === "boolean") return data.from_me;

  return false;
}

function getMessageKey(message: WahaChatMessage, index: number) {
  const id = message.id;
  if (typeof id === "string") return id;

  const idObject = getRecord(id);
  const serialized = getString(idObject?._serialized) || getString(idObject?.id);
  return serialized || `${message.timestamp ?? "message"}-${index}`;
}
function resolveErrorMessage(response: Response, fallback: string) {
  if (response.status === 401) {
    return "Session expired. Please log in again.";
  }

  if (response.status === 502) {
    return "Chat history is unavailable from the current WAHA engine/store configuration.";
  }

  return fallback;
}

export function WhatsappInboxButton() {
  const [opened, setOpened] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [status, setStatus] = useState("UNKNOWN");
  const [chats, setChats] = useState<WahaChatOverview[]>([]);
  const [messages, setMessages] = useState<WahaChatMessage[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedChat = useMemo(
    () => chats.find((chat) => getChatId(chat) === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/waha/status");
      const data = (await response.json()) as WahaStatusResponse;
      setStatus(data.status || "UNKNOWN");
    } catch {
      setStatus("ERROR");
    }
  }, []);

  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    setChatError(null);

    try {
      const response = await fetch(`/api/waha/chats?limit=${CHAT_PAGE_LIMIT}&offset=0`);
      const data = (await response.json()) as ChatsResponse;

      if (!response.ok) {
        throw new Error(
          resolveErrorMessage(response, data.error || "Failed to load WhatsApp chats."),
        );
      }

      const loadedChats = Array.isArray(data.chats) ? data.chats : [];
      setChats(loadedChats);
      return loadedChats;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load WhatsApp chats.";
      setChatError(message);
      return null;
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const fetchMessages = useCallback(async (chatId: string) => {
    setLoadingMessages(true);
    setMessageError(null);

    try {
      const response = await fetch(
        `/api/waha/chats/${encodeURIComponent(chatId)}/messages?limit=${MESSAGE_LIMIT}`,
      );
      const data = (await response.json()) as MessagesResponse;

      if (!response.ok) {
        throw new Error(
          resolveErrorMessage(response, data.error || "Failed to load WhatsApp messages."),
        );
      }

      setMessages(Array.isArray(data.messages) ? data.messages : []);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load WhatsApp messages.";
      setMessageError(message);
      return false;
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const refreshInbox = useCallback(async () => {
    const activeChatId = selectedChatId;
    await fetchStatus();
    const loadedChats = await fetchChats();

    if (activeChatId) {
      const activeChatStillVisible =
        !loadedChats || loadedChats.some((chat) => getChatId(chat) === activeChatId);

      if (activeChatStillVisible) {
        await fetchMessages(activeChatId);
      } else {
        setSelectedChatId(null);
        setMessages([]);
        setMessageError(null);
      }
    }

    setHasLoadedOnce(true);
  }, [fetchChats, fetchMessages, fetchStatus, selectedChatId]);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      setSelectedChatId(chatId);
      setMessages([]);
      void fetchMessages(chatId);
    },
    [fetchMessages],
  );

  const handleSend = async () => {
    if (!selectedChatId || !messageText.trim()) return;

    setSending(true);
    try {
      const response = await fetch(
        `/api/waha/chats/${encodeURIComponent(selectedChatId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: messageText.trim() }),
        },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to send WhatsApp message.");
      }

      setMessageText("");
      notifications.show({
        title: "Message sent",
        message: "WhatsApp message sent successfully.",
        color: "green",
      });
      await fetchMessages(selectedChatId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send WhatsApp message.";
      notifications.show({
        title: "Send failed",
        message,
        color: "red",
      });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (opened && !hasLoadedOnce) {
      void refreshInbox();
    }
  }, [hasLoadedOnce, opened, refreshInbox]);

  const isConnected = status === "WORKING";
  const composerDisabled = !selectedChatId || !isConnected || sending;
  return (
    <>
      <Tooltip label="Open WhatsApp inbox" position="left">
        <ActionIcon
          aria-label="Open WhatsApp inbox"
          color="green"
          radius="xl"
          size={58}
          onClick={() => setOpened(true)}
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            zIndex: 200,
            boxShadow: "var(--mantine-shadow-lg)",
          }}
        >
          <IconBrandWhatsapp size={30} />
        </ActionIcon>
      </Tooltip>

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        title="WhatsApp Inbox"
        position="right"
        size="xl"
        padding="md"
      >
        <Stack gap="md" h="calc(100vh - 88px)">
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Badge color={isConnected ? "green" : status === "ERROR" ? "red" : "gray"} variant="light">
                {status}
              </Badge>
              {!isConnected && (
                <Text size="xs" c="dimmed">
                  Connect it from Settings &gt; WhatsApp Connect.
                </Text>
              )}
            </Group>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRefresh size={14} />}
              onClick={() => void refreshInbox()}
              loading={loadingChats || loadingMessages}
            >
              Refresh
            </Button>
          </Group>

          {chatError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title="Unable to load chats">
              {chatError}
            </Alert>
          )}

          <Paper withBorder radius="md" style={{ flex: 1, overflow: "hidden" }}>
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px, 0.9fr) minmax(0, 1.4fr)",
                height: "100%",
              }}
            >
              <Box style={{ borderRight: "1px solid var(--mantine-color-gray-2)", minHeight: 0 }}>
                <ScrollArea h="100%">
                  <Stack gap={0}>
                    {loadingChats && chats.length === 0 ? (
                      <Group justify="center" py="xl">
                        <Loader size="sm" />
                        <Text size="sm" c="dimmed">Loading chats...</Text>
                      </Group>
                    ) : chats.length === 0 ? (
                      <Stack align="center" gap="xs" py="xl" px="md">
                        <ThemeIcon color="gray" variant="light" radius="xl" size={44}>
                          <IconMessageCircle size={22} />
                        </ThemeIcon>
                        <Text fw={600} size="sm">No chats loaded</Text>
                        <Text size="xs" c="dimmed" ta="center">
                          Click Refresh to load WhatsApp conversations.
                        </Text>
                      </Stack>
                    ) : (
                      chats.map((chat) => {
                        const chatId = getChatId(chat);
                        const active = chatId === selectedChatId;
                        const preview = extractMessageText(chat.lastMessage);

                        return (
                          <UnstyledButton
                            key={chatId}
                            onClick={() => handleSelectChat(chatId)}
                            disabled={!chatId}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "12px",
                              background: active ? "var(--mantine-color-green-0)" : undefined,
                              borderBottom: "1px solid var(--mantine-color-gray-1)",
                            }}
                          >
                            <Group gap="sm" align="flex-start" wrap="nowrap">
                              <Avatar src={chat.picture || undefined} radius="xl" color="green">
                                {getChatName(chat).slice(0, 1).toUpperCase()}
                              </Avatar>
                              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                                <Group justify="space-between" gap="xs" wrap="nowrap">
                                  <Text size="sm" fw={600} truncate>{getChatName(chat)}</Text>
                                  <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                                    {formatTime(chat.lastMessage?.timestamp)}
                                  </Text>
                                </Group>
                                <Text size="xs" c="dimmed" truncate>{chatId}</Text>
                                <Text size="xs" truncate>{preview || "No text preview"}</Text>
                              </Stack>
                            </Group>
                          </UnstyledButton>
                        );
                      })
                    )}
                  </Stack>
                </ScrollArea>
              </Box>
              <Stack gap="sm" p="md" style={{ minHeight: 0 }}>
                {selectedChat ? (
                  <>
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Text fw={700} truncate>{getChatName(selectedChat)}</Text>
                      <Text size="xs" c="dimmed" truncate>{selectedChatId}</Text>
                    </Stack>

                    {messageError && (
                      <Alert icon={<IconAlertCircle size={16} />} color="red" title="Unable to load messages">
                        {messageError}
                      </Alert>
                    )}

                    <Divider />

                    <ScrollArea style={{ flex: 1 }}>
                      <Stack gap="xs" pr="xs">
                        {loadingMessages && messages.length === 0 ? (
                          <Group justify="center" py="xl">
                            <Loader size="sm" />
                            <Text size="sm" c="dimmed">Loading messages...</Text>
                          </Group>
                        ) : messages.length === 0 ? (
                          <Stack align="center" py="xl" gap="xs">
                            <ThemeIcon color="gray" variant="light" radius="xl" size={44}>
                              <IconMessageCircle size={22} />
                            </ThemeIcon>
                            <Text fw={600} size="sm">No messages loaded</Text>
                            <Text size="xs" c="dimmed" ta="center">
                              Click Refresh if this chat has history.
                            </Text>
                          </Stack>
                        ) : (
                          messages.map((message, index) => {
                            const outgoing = isFromMe(message);
                            const text = extractMessageText(message) || "Unsupported message content";

                            return (
                              <Group key={getMessageKey(message, index)} justify={outgoing ? "flex-end" : "flex-start"} align="flex-end">
                                <Box
                                  maw="78%"
                                  px="sm"
                                  py={8}
                                  style={{
                                    borderRadius: "var(--mantine-radius-md)",
                                    background: outgoing
                                      ? "var(--mantine-color-green-1)"
                                      : "var(--mantine-color-gray-1)",
                                  }}
                                >
                                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{text}</Text>
                                  <Text size="xs" c="dimmed" ta="right" mt={4}>
                                    {formatTime(message.timestamp)}
                                  </Text>
                                </Box>
                              </Group>
                            );
                          })
                        )}
                      </Stack>
                    </ScrollArea>

                    {!isConnected && (
                      <Alert color="yellow" title="WhatsApp is not connected">
                        WhatsApp is not connected. Connect it from Settings &gt; WhatsApp Connect.
                      </Alert>
                    )}

                    <Group align="flex-end" wrap="nowrap">
                      <Textarea
                        label="Message"
                        placeholder="Type a WhatsApp message"
                        value={messageText}
                        onChange={(event) => setMessageText(event.currentTarget.value)}
                        autosize
                        minRows={1}
                        maxRows={4}
                        disabled={composerDisabled}
                        style={{ flex: 1 }}
                      />
                      <ActionIcon
                        aria-label="Send WhatsApp message"
                        color="green"
                        size="lg"
                        onClick={() => void handleSend()}
                        loading={sending}
                        disabled={composerDisabled || !messageText.trim()}
                      >
                        <IconSend size={18} />
                      </ActionIcon>
                    </Group>
                  </>
                ) : (
                  <Stack align="center" justify="center" h="100%" gap="sm">
                    <ThemeIcon color="green" variant="light" radius="xl" size={56}>
                      <IconBrandWhatsapp size={28} />
                    </ThemeIcon>
                    <Text fw={700}>Select a chat</Text>
                    <Text size="sm" c="dimmed" ta="center" maw={320}>
                      Choose a WhatsApp chat from the list, then use manual refresh to load messages.
                    </Text>
                  </Stack>
                )}
              </Stack>
            </Box>
          </Paper>
        </Stack>
      </Drawer>
    </>
  );
}
