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

type WahaSessionConfig = {
  webhooks?: WahaWebhookConfig[];
};

type WahaLidMapping = {
  lid: string;
  pn: string;
};

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
    apiClient.get(`/api/sessions/${session}`).then((res) => res.data),
  startSession: async (session: string) =>
    apiClient
      .post("/api/sessions/start", { name: session })
      .then((res) => res.data),
  updateSessionConfig: async (session: string, config: WahaSessionConfig) =>
    apiClient
      .put(`/api/sessions/${session}`, {
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
        .get(`/api/${session}/lids/${encodeURIComponent(trimmedLid)}`)
        .then((res) => res.data as WahaLidMapping);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }

      throw error;
    }
  },
  getQR: async (session: string) =>
    apiClient.get(`/api/${session}/auth/qr`).then((res) => res.data),
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
