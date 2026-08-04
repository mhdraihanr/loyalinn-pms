import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

type AiProviderName = "gemini" | "9router";

function normalizeProviderName(value: string | undefined): AiProviderName {
  const normalized = value?.trim().toLowerCase();
  return normalized === "9router" || normalized === "ninerouter"
    ? "9router"
    : "gemini";
}

function getFirstConfiguredValue(candidates: Array<string | undefined>) {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
}

function getGeminiApiKey() {
  return getFirstConfiguredValue([
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ]);
}

function getNinerouterApiKey() {
  const apiKey = getFirstConfiguredValue([
    process.env.NINEROUTER_KEY,
    process.env.NINEROUTER_API_KEY,
  ]);

  return apiKey === "" ? undefined : apiKey;
}

function getNinerouterBaseUrl() {
  const configuredUrl = getFirstConfiguredValue([
    process.env.NINEROUTER_BASE_URL,
    process.env.NINEROUTER_URL,
  ]);
  const baseUrl = configuredUrl || "http://localhost:20128";

  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl.replace(/\/+$/, "")}/v1`;
}

export const AI_PROVIDER = normalizeProviderName(process.env.AI_PROVIDER);

const geminiProvider = createGoogleGenerativeAI({
  apiKey: getGeminiApiKey(),
});

const ninerouterProvider = createOpenAICompatible({
  name: "9router",
  apiKey: getNinerouterApiKey(),
  baseURL: getNinerouterBaseUrl(),
});

// Provider selected via AI_PROVIDER. Defaults to Gemini for existing deployments.
export const aiProvider = AI_PROVIDER === "9router" ? ninerouterProvider : geminiProvider;

// Primary lifecycle AI model. 9Router model IDs must match /v1/models data[].id.
export const AI_MODEL =
  AI_PROVIDER === "9router"
    ? process.env.NINEROUTER_MODEL || "kr/claude-sonnet-4.5"
    : process.env.GEMINI_MODEL || "gemini-2.5-flash";
