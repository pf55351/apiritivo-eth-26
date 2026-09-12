export const ROLES = ["client", "provider"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return value === "client" || value === "provider";
}

export const ROLE_HOME: Record<Role, string> = {
  client: "/marketplace",
  provider: "/provider",
};
