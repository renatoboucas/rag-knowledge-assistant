import type { Permission, WorkspaceRole } from "@rag/types";

export const rolePermissions = {
  owner: [
    "workspace:read",
    "workspace:update",
    "members:read",
    "members:invite",
    "members:remove",
    "knowledge:read",
    "knowledge:write",
    "settings:read",
    "settings:update",
    "security:read",
    "security:audit",
    "data:export",
    "data:delete",
  ],
  admin: [
    "workspace:read",
    "workspace:update",
    "members:read",
    "members:invite",
    "members:remove",
    "knowledge:read",
    "knowledge:write",
    "settings:read",
    "settings:update",
    "security:read",
    "security:audit",
    "data:export",
  ],
  member: ["workspace:read", "members:read", "knowledge:read", "knowledge:write", "settings:read"],
  viewer: ["workspace:read", "members:read", "knowledge:read", "settings:read"],
} satisfies Record<WorkspaceRole, Permission[]>;

export function normalizeClerkRole(role?: string | null): WorkspaceRole {
  if (role === "org:admin") {
    return "admin";
  }

  if (role === "org:viewer") {
    return "viewer";
  }

  return "member";
}

export function can(role: WorkspaceRole, permission: Permission) {
  return (rolePermissions[role] as readonly Permission[]).includes(permission);
}

export function requirePermission(role: WorkspaceRole, permission: Permission) {
  if (!can(role, permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}
