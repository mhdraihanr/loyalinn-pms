import { createOpenAI } from "@ai-sdk/openai";

// Konfigurasi OpenRouter menggunakan base API dari OpenAI SDK
export const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  // Opsional: Headers default yang direkomendasikan OpenRouter
  // headers: {
  //   'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || '',
  //   'X-Title': 'Automation Worker App',
  // },
});

// Model minimax free di OpenRouter
export const AI_MODEL = process.env.OPENROUTER_MODEL || "minimax/minimax-01";
