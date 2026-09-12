export const ROLES = ["client", "provider"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return value === "client" || value === "provider";
}

/** localStorage key: role is a per-identity app preference, not a security boundary. */
export function roleStorageKey(identityId: string): string {
  return `apiperitivo:role:${identityId}`;
}

export const ROLE_HOME: Record<Role, string> = {
  client: "/marketplace",
  provider: "/provider",
};
