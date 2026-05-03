import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("operations dashboard UI consistency", () => {
  it("uses the shared dashboard page shell and summary cards", () => {
    const pageSource = readSource("app/(dashboard)/operations/page.tsx");

    expect(pageSource).toContain("PageAutoRefresh");
    expect(pageSource).toContain("SimpleGrid");
    expect(pageSource).toContain("Card");
    expect(pageSource).toContain("Operational workload");
    expect(pageSource).toContain("Ringkasan antrean operasional hotel");
  });

  it("shows operation tab icons and queue counts", () => {
    const tabsSource = readSource("components/operations/operations-tabs.tsx");

    expect(tabsSource).toContain("@tabler/icons-react");
    expect(tabsSource).toContain("leftSection");
    expect(tabsSource).toContain('aria-label="Operations queues"');
    expect(tabsSource).toContain("housekeepingData.length");
    expect(tabsSource).toContain("roomServiceData.length");
    expect(tabsSource).toContain("arrivalRequestsData.length");
  });
});
