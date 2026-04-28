import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(projectRoot, path), "utf8");
}

describe("arrival requests schema", () => {
  it("defines arrival request operational queue with tenant RLS and realtime", () => {
    const migration = readProjectFile(
      "supabase/migrations/20260428000000_add_arrival_requests.sql",
    );
    const schema = readProjectFile("supabase/schema.sql");

    for (const sql of [migration, schema]) {
      expect(sql).toContain("arrival_requests");
      expect(sql).toContain(
        "request_type TEXT NOT NULL CHECK (request_type IN ('arrival_eta', 'early_checkin'))",
      );
      expect(sql).toContain(
        "status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved', 'cancelled'))",
      );
      expect(sql).toContain("WITH CHECK (tenant_id = public.get_user_tenant_id())");
      expect(sql).toContain("idx_arrival_requests_tenant_id");
      expect(sql).toContain("idx_arrival_requests_status");
    }

    expect(migration).toContain(
      "ALTER PUBLICATION supabase_realtime ADD TABLE arrival_requests",
    );
  });
});
