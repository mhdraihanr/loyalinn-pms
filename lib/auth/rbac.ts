export type Role = "owner" | "admin" | "agent";

export const ROLE_PERMISSIONS = {
  owner: ["*"], // Full access
  admin: [
    "guests:read",
    "guests:write",
    "reservations:read",
    "reservations:write",
    "messages:read",
    "messages:send",
    "templates:read",
    "templates:write",
    "settings:read",
    "settings:write",
  ],
  agent: [
    "guests:read",
    "reservations:read",
    "messages:read",
    "messages:send",
    "templates:read",
  ],
} as const;

export function hasPermission(role: Role, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes("*") || permissions.includes(permission);
}

export function requirePermission(role: Role, permission: string): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Insufficient permissions. Required: ${permission}`);
  }
}
