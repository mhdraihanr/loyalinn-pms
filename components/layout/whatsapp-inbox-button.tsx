"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { createClient } from "@/lib/supabase/client";
import type {
  WhatsappConversation,
  WhatsappMessage,
} from "@/lib/data/whatsapp-inbox";

const CHAT_PAGE_LIMIT = 50;
const MESSAGE_LIMIT = 100;

type WahaStatusResponse = {
  status?: string;
};

type ConversationsResponse = {
  conversations?: WhatsappConversation[];
  tenantId?: string;
  error?: string;
};

type MessagesResponse = {
  conversation?: WhatsappConversation;
  messages?: WhatsappMessage[];
  error?: string;
};

type SendResponse = {
  sent?: boolean;
  message?: WhatsappMessage;
  error?: string;
};

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function messageTime(message: WhatsappMessage) {
  return new Date(message.sent_at ?? message.created_at).getTime() || 0;
}

function sortConversations(conversations: WhatsappConversation[]) {
  return [...conversations].sort((left, right) => {
    const rightTime = new Date(right.last_message_at ?? right.updated_at).getTime();
    const leftTime = new Date(left.last_message_at ?? left.updated_at).getTime();
    return rightTime - leftTime;
  });
}

export function mergeInboxMessage(
  messages: WhatsappMessage[],
  next: WhatsappMessage,
) {
  const matchIndex = messages.findIndex(
    (message) =>
      message.id === next.id ||
      (next.client_message_id && message.client_message_id === next.client_message_id) ||
      (next.idempotency_key && message.idempotency_key === next.idempotency_key) ||
      (next.provider_message_id &&
        message.provider_message_id === next.provider_message_id),
  );

  if (matchIndex === -1) {
    return [...messages, next].sort((left, right) => messageTime(left) - messageTime(right));
  }

  return messages
    .map((message, index) => (index === matchIndex ? { ...message, ...next } : message))
    .sort((left, right) => messageTime(left) - messageTime(right));
}

function resolveErrorMessage(response: Response, fallback: string) {
  if (response.status === 401) return "Session expired. Please log in again.";
  if (response.status === 403) return "WhatsApp inbox is unavailable for this tenant.";
  return fallback;
}

export function WhatsappInboxButton() {
  const [opened, setOpened] = useState(false);
  const [status, setStatus] = useState("UNKNOWN");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<WhatsappConversation[]>([]);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageRequestRef = useRef(0);
  const messageAbortRef = useRef<AbortController | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }

  const selectedConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );
  const selectedConversationRequestId = selectedConversation?.id ?? null;

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/waha/status");
      const data = (await response.json()) as WahaStatusResponse;
      setStatus(data.status || "UNKNOWN");
    } catch {
      setStatus("ERROR");
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    setLoadingChats(true);
    setChatError(null);

    try {
      const response = await fetch(`/api/waha/chats?limit=${CHAT_PAGE_LIMIT}`);
      const data = (await response.json()) as ConversationsResponse;
      if (!response.ok) {
        throw new Error(
          resolveErrorMessage(response, data.error || "Failed to load WhatsApp conversations."),
        );
      }

      const loadedConversations = Array.isArray(data.conversations)
        ? sortConversations(data.conversations)
        : [];
      setConversations(loadedConversations);
      setTenantId(data.tenantId || null);
      setSelectedConversationId((current) =>
        current && loadedConversations.some((conversation) => conversation.id === current)
          ? current
          : loadedConversations[0]?.id ?? null,
      );
      return loadedConversations;
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Failed to load WhatsApp conversations.",
      );
      return null;
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    messageAbortRef.current?.abort();
    const controller = new AbortController();
    messageAbortRef.current = controller;
    const requestId = ++messageRequestRef.current;
    setLoadingMessages(true);
    setMessageError(null);

    try {
      const response = await fetch(
        `/api/waha/chats/${encodeURIComponent(conversationId)}/messages?limit=${MESSAGE_LIMIT}`,
        { signal: controller.signal },
      );
      const data = (await response.json()) as MessagesResponse;
      if (requestId !== messageRequestRef.current) return false;
      if (!response.ok) {
        throw new Error(
          resolveErrorMessage(response, data.error || "Failed to load WhatsApp messages."),
        );
      }
      if (data.conversation?.id !== conversationId) return false;

      setMessages(Array.isArray(data.messages) ? data.messages : []);
      return true;
    } catch (error) {
      if (requestId !== messageRequestRef.current || controller.signal.aborted) {
        return false;
      }
      setMessageError(
        error instanceof Error ? error.message : "Failed to load WhatsApp messages.",
      );
      return false;
    } finally {
      if (requestId === messageRequestRef.current) {
        setLoadingMessages(false);
      }
    }
  }, []);

  const markRead = useCallback(async (conversation: WhatsappConversation) => {
    try {
      await fetch(`/api/waha/chats/${encodeURIComponent(conversation.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-read" }),
      });
    } catch {
      // Realtime/snapshot remains authoritative; a failed read marker is non-blocking.
    }
  }, []);

  const syncInbox = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchConversations()]);
  }, [fetchConversations, fetchStatus]);

  const scheduleHydratedRefresh = useCallback(
    (refreshMessages = false) => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        void fetchConversations();
        if (refreshMessages && selectedConversationRequestId) {
          void fetchMessages(selectedConversationRequestId);
        }
      }, 150);
    },
    [fetchConversations, fetchMessages, selectedConversationRequestId],
  );

  const handleSelectConversation = useCallback(
    (conversation: WhatsappConversation) => {
      if (conversation.id === selectedConversationId) {
        if (!loadingMessages && messages.length === 0) {
          void fetchMessages(conversation.id);
        }
        void markRead(conversation);
        return;
      }

      setLoadingMessages(true);
      setMessages([]);
      setSelectedConversationId(conversation.id);
      void markRead(conversation);
    },
    [fetchMessages, loadingMessages, markRead, messages.length, selectedConversationId],
  );

  const handleSend = async () => {
    if (!selectedConversation || !messageText.trim()) return;

    const text = messageText.trim();
    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: WhatsappMessage = {
      id: clientMessageId,
      tenant_id: selectedConversation.tenant_id,
      conversation_id: selectedConversation.id,
      session_name: selectedConversation.session_name,
      chat_id: selectedConversation.chat_id,
      provider_message_id: null,
      client_message_id: clientMessageId,
      idempotency_key: `client:${clientMessageId}`,
      direction: "outbound",
      content: text,
      status: "sending",
      error_message: null,
      provider_response: null,
      created_by: null,
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMessages((current) => mergeInboxMessage(current, optimisticMessage));
    setMessageText("");
    setSending(true);

    try {
      const response = await fetch(
        `/api/waha/chats/${encodeURIComponent(selectedConversation.id)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, clientMessageId }),
        },
      );
      const data = (await response.json()) as SendResponse;

      if (data.message) {
        setMessages((current) => mergeInboxMessage(current, data.message!));
      }

      if (response.status === 409) {
        void fetchMessages(selectedConversation.id);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to send WhatsApp message.");
      }
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Failed to send WhatsApp message.";
      setMessages((current) =>
        current.map((message) =>
          message.client_message_id === clientMessageId
            ? { ...message, status: "failed", error_message: failure }
            : message,
        ),
      );
      notifications.show({ title: "Send failed", message: failure, color: "red" });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!opened) return;
    void syncInbox();
  }, [opened, syncInbox]);

  useEffect(() => {
    if (!opened || !selectedConversationRequestId) return;
    void fetchMessages(selectedConversationRequestId);
  }, [fetchMessages, opened, selectedConversationRequestId]);

  useEffect(() => {
    if (!opened || !tenantId) return;
    const supabase = supabaseRef.current!;
    const channel = supabase
      .channel(`whatsapp-inbox:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversations",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setConversations((current) =>
              current.filter((conversation) => conversation.id !== payload.old.id),
            );
            return;
          }
          scheduleHydratedRefresh(false);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setMessages((current) => current.filter((message) => message.id !== payload.old.id));
            scheduleHydratedRefresh(false);
            return;
          }
          const next = payload.new as WhatsappMessage;
          scheduleHydratedRefresh(next.conversation_id === selectedConversationId);
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") {
          void fetchConversations();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchConversations, opened, scheduleHydratedRefresh, selectedConversationId, tenantId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && opened) {
        void syncInbox();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [opened, syncInbox]);

  useEffect(() => {
    if (!opened || !selectedConversationId || loadingMessages) return;
    requestAnimationFrame(() => {
      const viewport = messagesViewportRef.current;
      if (!viewport) return;
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      if (distanceFromBottom < 120) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
    });
  }, [loadingMessages, messages.length, opened, selectedConversationId]);

  const isConnected = status === "WORKING";
  const composerDisabled = !selectedConversation || !isConnected || sending;

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
              onClick={() => void syncInbox()}
              loading={loadingChats || loadingMessages}
            >
              Sync now
            </Button>
          </Group>

          {chatError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title="Unable to load conversations">
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
                    {loadingChats && conversations.length === 0 ? (
                      <Group justify="center" py="xl"><Loader size="sm" /><Text size="sm" c="dimmed">Loading chats...</Text></Group>
                    ) : conversations.length === 0 ? (
                      <Stack align="center" gap="xs" py="xl" px="md">
                        <ThemeIcon color="gray" variant="light" radius="xl" size={44}><IconMessageCircle size={22} /></ThemeIcon>
                        <Text fw={600} size="sm">No conversations yet</Text>
                        <Text size="xs" c="dimmed" ta="center">New direct WhatsApp messages appear here automatically.</Text>
                      </Stack>
                    ) : (
                      conversations.map((conversation) => {
                        const active = conversation.id === selectedConversationId;
                        const title = conversation.identity_title || conversation.display_name || conversation.normalized_phone || conversation.chat_id.split("@")[0];
                        const subtitle = conversation.identity_subtitle || conversation.normalized_phone || conversation.chat_id;
                        return (
                          <UnstyledButton
                            key={conversation.id}
                            onClick={() => handleSelectConversation(conversation)}
                            style={{ display: "block", width: "100%", padding: 12, background: active ? "var(--mantine-color-green-0)" : undefined, borderBottom: "1px solid var(--mantine-color-gray-1)" }}
                          >
                            <Group gap="sm" align="flex-start" wrap="nowrap">
                              <Avatar radius="xl" color="green">{title.slice(0, 1).toUpperCase()}</Avatar>
                              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                                <Group justify="space-between" gap="xs" wrap="nowrap">
                                  <Text size="sm" fw={600} truncate>{title}</Text>
                                  <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{formatTime(conversation.last_message_at)}</Text>
                                </Group>
                                <Text size="xs" c="dimmed" truncate>{subtitle}</Text>
                                <Group justify="space-between" gap="xs" wrap="nowrap">
                                  <Group gap={4} wrap="nowrap">
                                    {conversation.lifecycle_stage && <Badge size="xs" variant="light">{conversation.lifecycle_stage}</Badge>}
                                    {conversation.needs_human_follow_up && <Badge size="xs" color="orange">Handoff</Badge>}
                                  </Group>
                                  {conversation.unread_count > 0 && <Badge color="green" size="sm" circle>{conversation.unread_count}</Badge>}
                                </Group>
                                <Text size="xs" truncate>{conversation.last_message_preview || "No text preview"}</Text>
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
                {selectedConversation ? (
                  <>
                    <Stack gap={2}>
                      <Text fw={700} truncate>{selectedConversation.identity_title || selectedConversation.display_name || selectedConversation.normalized_phone || selectedConversation.chat_id}</Text>
                      <Text size="xs" c="dimmed" truncate>{selectedConversation.identity_subtitle || selectedConversation.normalized_phone || selectedConversation.chat_id}</Text>
                      <Group gap={4}>
                        {selectedConversation.lifecycle_stage && <Badge size="xs" variant="light">{selectedConversation.lifecycle_stage}</Badge>}
                        {selectedConversation.needs_human_follow_up && <Badge size="xs" color="orange">Human handoff</Badge>}
                      </Group>
                    </Stack>
                    {messageError && <Alert icon={<IconAlertCircle size={16} />} color="red" title="Unable to load messages">{messageError}</Alert>}
                    <Divider />
                    <ScrollArea viewportRef={messagesViewportRef} offsetScrollbars style={{ flex: 1 }}>
                      <Stack gap="xs" pr="xs">
                        {loadingMessages && messages.length === 0 ? (
                          <Group justify="center" py="xl"><Loader size="sm" /><Text size="sm" c="dimmed">Loading messages...</Text></Group>
                        ) : messages.length === 0 ? (
                          <Stack align="center" py="xl" gap="xs"><ThemeIcon color="gray" variant="light" radius="xl" size={44}><IconMessageCircle size={22} /></ThemeIcon><Text fw={600} size="sm">No messages yet</Text></Stack>
                        ) : messages.map((message) => {
                          const outgoing = message.direction === "outbound";
                          return (
                            <Group key={message.id} justify={outgoing ? "flex-end" : "flex-start"} align="flex-end">
                              <Box maw="78%" px="sm" py={8} style={{ borderRadius: "var(--mantine-radius-md)", background: outgoing ? "var(--mantine-color-green-1)" : "var(--mantine-color-gray-1)" }}>
                                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{message.content}</Text>
                                <Text size="xs" c={message.status === "failed" ? "red" : "dimmed"} ta="right" mt={4}>{message.status === "failed" ? "Failed" : formatTime(message.sent_at ?? message.created_at)}</Text>
                              </Box>
                            </Group>
                          );
                        })}
                      </Stack>
                    </ScrollArea>
                    {!isConnected && <Alert color="yellow" title="WhatsApp is not connected">WhatsApp is not connected. Connect it from Settings &gt; WhatsApp Connect.</Alert>}
                    <Group align="flex-end" wrap="nowrap">
                      <Textarea label="Message" placeholder="Type a WhatsApp message" value={messageText} onChange={(event) => setMessageText(event.currentTarget.value)} autosize minRows={1} maxRows={4} disabled={composerDisabled} style={{ flex: 1 }} />
                      <ActionIcon aria-label="Send WhatsApp message" color="green" size="lg" onClick={() => void handleSend()} loading={sending} disabled={composerDisabled || !messageText.trim()}><IconSend size={18} /></ActionIcon>
                    </Group>
                  </>
                ) : (
                  <Stack align="center" justify="center" h="100%" gap="sm"><ThemeIcon color="green" variant="light" radius="xl" size={56}><IconBrandWhatsapp size={28} /></ThemeIcon><Text fw={700}>Select a chat</Text><Text size="sm" c="dimmed" ta="center" maw={320}>New direct WhatsApp messages appear automatically without refreshing this page.</Text></Stack>
                )}
              </Stack>
            </Box>
          </Paper>
        </Stack>
      </Drawer>
    </>
  );
}
