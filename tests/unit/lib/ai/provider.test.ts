import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function importFreshProviderModule() {
  vi.resetModules();
  return import("@/lib/ai/provider");
}

describe("AI model provider config", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("uses GEMINI_MODEL when configured", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash";

    const providerModule = await importFreshProviderModule();

    expect(providerModule.AI_MODEL).toBe("gemini-2.5-flash");
  });

  it("defaults to gemini-2.5-flash when GEMINI_MODEL is missing", async () => {
    delete process.env.GEMINI_MODEL;

    const providerModule = await importFreshProviderModule();

    expect(providerModule.AI_MODEL).toBe("gemini-2.5-flash");
  });
});
