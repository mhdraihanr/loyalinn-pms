import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(projectRoot, path), "utf8");
}

describe("on-stay request schema", () => {
  it("keeps room service and housekeeping status values aligned for operations", () => {
    const migration = readProjectFile(
      "supabase/migrations/20240320000001_add_on_stay_requests.sql",
    );
    const schema = readProjectFile("supabase/schema.sql");

    for (const sql of [migration, schema]) {
      expect(sql).toContain("room_service_orders");
      expect(sql).toContain(
        "status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled'))",
      );
      expect(sql).not.toContain(
        "status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'delivered', 'cancelled'))",
      );
      expect(sql).toContain("WITH CHECK (tenant_id = public.get_user_tenant_id())");
    }
  });
});
