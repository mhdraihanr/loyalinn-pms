import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";

import GuestsPage from "@/app/(dashboard)/guests/page";

const mocks = vi.hoisted(() => ({
  pageAutoRefreshMock: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-auto-refresh">{children}</div>
  )),
}));

vi.mock("@/lib/auth/tenant", () => ({
  getCurrentUserTenant: vi.fn().mockResolvedValue({
    tenantId: "tenant-1",
    role: "owner",
  }),
}));

vi.mock("@/lib/data/guests", () => ({
  getGuests: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/guests/guests-table", () => ({
  GuestsTable: () => <div>guests-table</div>,
}));

vi.mock("@/components/layout/page-auto-refresh", () => ({
  PageAutoRefresh: mocks.pageAutoRefreshMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("GuestsPage", () => {
  it("wraps guest content in an auto-refresh boundary", async () => {
    const element = await GuestsPage();

    renderToStaticMarkup(<MantineProvider>{element}</MantineProvider>);

    expect(mocks.pageAutoRefreshMock).toHaveBeenCalledWith(
      expect.objectContaining({ intervalMs: 10_000 }),
      undefined,
    );
  });

  it("renders the guests table content", async () => {
    const element = await GuestsPage();
    const html = renderToStaticMarkup(
      <MantineProvider>{element}</MantineProvider>,
    );

    expect(html).toContain("guests-table");
  });
});