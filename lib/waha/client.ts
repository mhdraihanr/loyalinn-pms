import axios from "axios";

const WAHA_BASE_URL = process.env.WAHA_BASE_URL;
const WAHA_API_KEY = process.env.WAHA_API_KEY;

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
  getQR: async (session: string) =>
    apiClient.get(`/api/${session}/auth/qr`).then((res) => res.data),
  logoutSession: async (session: string) =>
    apiClient
      .post(`/api/sessions/logout`, { name: session })
      .then((res) => res.data),
  sendMessage: async (session: string, chatId: string, text: string) =>
    apiClient
      .post(`/api/${session}/sendText`, { chatId, text })
      .then((res) => res.data),
};
