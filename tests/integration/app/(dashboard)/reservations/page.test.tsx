import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";

import ReservationsPage from "@/app/(dashboard)/reservations/page";

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

vi.mock("@/lib/data/reservations", () => ({
  getReservations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/components/reservations/reservations-table", () => ({
  ReservationsTable: () => <div>reservations-table</div>,
}));

vi.mock("@/components/reservations/reservations-tabs", () => ({
  ReservationsTabs: () => <div>reservations-tabs</div>,
}));

vi.mock("@/components/layout/page-auto-refresh", () => ({
  PageAutoRefresh: mocks.pageAutoRefreshMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("ReservationsPage", () => {
  it("wraps reservation content in an auto-refresh boundary", async () => {
    const element = await ReservationsPage({
      searchParams: Promise.resolve({ status: "all" }),
    });

    renderToStaticMarkup(<MantineProvider>{element}</MantineProvider>);

    expect(mocks.pageAutoRefreshMock).toHaveBeenCalledWith(
      expect.objectContaining({ intervalMs: 10_000 }),
      undefined,
    );
  });

  it("does not render the manual PMS sync button", async () => {
    const element = await ReservationsPage({
      searchParams: Promise.resolve({ status: "all" }),
    });
    const html = renderToStaticMarkup(
      <MantineProvider>{element}</MantineProvider>,
    );

    expect(html).not.toContain("Sync PMS");
  });
});