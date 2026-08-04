import axios from "axios";

const WAHA_BASE_URL = process.env.WAHA_BASE_URL;
const WAHA_API_KEY = process.env.WAHA_API_KEY;

type WahaWebhookConfig = {
  url: string;
  events: string[];
  hmac?: {
    key: string;
  };
  retries?: {
    policy: "constant" | "linear" | "exponential";
    delaySeconds: number;
    attempts: number;
  };
  customHeaders?: Array<{
    name: string;
    value: string;
  }>;
};

export type WahaSessionConfig = {
  webhooks?: WahaWebhookConfig[];
  noweb?: {
    markOnline?: boolean;
    store?: {
      enabled: boolean;
      fullSync: boolean;
    };
  };
};

type WahaLidMapping = {
  lid: string;
  pn: string;
};

export type WahaChatMessage = {
  id?: unknown;
  timestamp?: number | string | null;
  from?: unknown;
  fromMe?: boolean;
  from_me?: boolean;
  to?: unknown;
  body?: unknown;
  text?: unknown;
  caption?: unknown;
  content?: unknown;
  _data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type WahaChatOverview = {
  id: string;
  name?: string | null;
  picture?: string | null;
  lastMessage?: WahaChatMessage | null;
  _chat?: unknown;
  [key: string]: unknown;
};

type WahaChatsOverviewOptions = {
  limit?: number;
  offset?: number;
};

type WahaChatMessagesOptions = {
  limit?: number;
  offset?: number;
  downloadMedia?: boolean;
};

function encodePathSegment(value: string) {
  return encodeURIComponent(value);
}

function normalizeWhatsAppChatId(chatId: string) {
  const trimmedChatId = chatId.trim();

  if (!trimmedChatId) {
    return trimmedChatId;
  }

  if (trimmedChatId.endsWith("@c.us")) {
    return trimmedChatId;
  }

  if (trimmedChatId.endsWith("@s.whatsapp.net")) {
    return trimmedChatId.replace(/@s\.whatsapp\.net$/, "@c.us");
  }

  if (trimmedChatId.includes("@")) {
    return trimmedChatId;
  }

  const cleanedNumber = trimmedChatId.startsWith("+")
    ? `+${trimmedChatId.slice(1).replace(/\D/g, "")}`
    : trimmedChatId.replace(/\D/g, "");

  if (!cleanedNumber || cleanedNumber === "+") {
    return trimmedChatId;
  }

  const internationalNumber = cleanedNumber.startsWith("+")
    ? cleanedNumber.slice(1)
    : cleanedNumber.startsWith("0")
      ? `62${cleanedNumber.slice(1)}`
      : cleanedNumber;

  return `${internationalNumber}@c.us`;
}

const apiClient = axios.create({
  baseURL: WAHA_BASE_URL,
  headers: {
    Accept: "application/json",
    "X-Api-Key": WAHA_API_KEY,
  },
});

export const wahaClient = {
  getSessions: async () =>
    apiClient.get("/api/sessions?all=true").then((res) => res.data),
  getSession: async (session: string) =>
    apiClient
      .get(`/api/sessions/${encodePathSegment(session)}`)
      .then((res) => res.data),
  getChatsOverview: async (
    session: string,
    options: WahaChatsOverviewOptions = {},
  ): Promise<WahaChatOverview[]> => {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;

    return apiClient
      .get(`/api/${encodePathSegment(session)}/chats/overview`, {
        params: { limit, offset },
      })
      .then((res) => res.data as WahaChatOverview[]);
  },
  getChatMessages: async (
    session: string,
    chatId: string,
    options: WahaChatMessagesOptions = {},
  ): Promise<WahaChatMessage[]> => {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const downloadMedia = options.downloadMedia ?? false;

    return apiClient
      .get(
        `/api/${encodePathSegment(session)}/chats/${encodePathSegment(chatId)}/messages`,
        { params: { limit, offset, downloadMedia } },
      )
      .then((res) => res.data as WahaChatMessage[]);
  },
  readChatMessages: async (session: string, chatId: string) =>
    apiClient
      .post(
        `/api/${encodePathSegment(session)}/chats/${encodePathSegment(chatId)}/messages/read`,
        {},
      )
      .then((res) => res.data),
  startSession: async (session: string, config?: WahaSessionConfig) =>
    apiClient
      .post("/api/sessions/start", {
        name: session,
        ...(config ? { config } : {}),
      })
      .then((res) => res.data),
  updateSessionConfig: async (session: string, config: WahaSessionConfig) =>
    apiClient
      .put(`/api/sessions/${encodePathSegment(session)}`, {
        name: session,
        config,
      })
      .then((res) => res.data),
  getLidMapping: async (
    session: string,
    lid: string,
  ): Promise<WahaLidMapping | null> => {
    const trimmedLid = lid.trim();
    if (!trimmedLid) {
      return null;
    }

    try {
      return await apiClient
        .get(
          `/api/${encodePathSegment(session)}/lids/${encodePathSegment(trimmedLid)}`,
        )
        .then((res) => res.data as WahaLidMapping);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }

      throw error;
    }
  },
  getQR: async (session: string) =>
    apiClient
      .get(`/api/${encodePathSegment(session)}/auth/qr`)
      .then((res) => res.data),
  logoutSession: async (session: string) =>
    apiClient
      .post(`/api/sessions/logout`, { name: session })
      .then((res) => res.data),
  sendMessage: async (session: string, chatId: string, text: string) =>
    apiClient
      .post("/api/sendText", {
        session,
        chatId: normalizeWhatsAppChatId(chatId),
        text,
      })
      .then((res) => res.data),
};
