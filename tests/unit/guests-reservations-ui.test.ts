import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("guests and reservations UI consistency", () => {
  it("upgrades the guests page shell with summary cards", () => {
    const pageSource = readSource("app/(dashboard)/guests/page.tsx");

    expect(pageSource).toContain("SimpleGrid");
    expect(pageSource).toContain("Card");
    expect(pageSource).toContain("Guests overview");
    expect(pageSource).toContain("Tier members");
    expect(pageSource).toContain("Guests with email");
    expect(pageSource).toContain("Loyalty points");
    expect(pageSource).toContain('padding="md"');
  });

  it("upgrades the reservations page shell with summary cards", () => {
    const pageSource = readSource("app/(dashboard)/reservations/page.tsx");

    expect(pageSource).toContain("SimpleGrid");
    expect(pageSource).toContain("Card");
    expect(pageSource).toContain("Reservations overview");
    expect(pageSource).toContain("Pre-arrival");
    expect(pageSource).toContain("On-stay");
    expect(pageSource).toContain("Checked out");
    expect(pageSource).not.toContain("Revenue snapshot");
    expect(pageSource).toContain('padding="md"');
  });

  it("adds client-side search and polished empty states to both tables", () => {
    const guestsTableSource = readSource("components/guests/guests-table.tsx");
    const reservationsTableSource = readSource(
      "components/reservations/reservations-table.tsx",
    );

    expect(guestsTableSource).toContain("Search guests");
    expect(guestsTableSource).toContain("No guests match your search");
    expect(guestsTableSource).toContain("useMemo");

    expect(reservationsTableSource).toContain("Search reservations");
    expect(reservationsTableSource).toContain(
      "No reservations match your search",
    );
    expect(reservationsTableSource).toContain("useMemo");
  });
});
