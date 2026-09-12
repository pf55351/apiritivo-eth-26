import type { Role } from "@apiritivo/shared";

/** Navigation of each workspace; Docs and service pages are shared. */
export const VIEW_LINKS: Record<Role, { href: string; label: string }[]> = {
  client: [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/passes", label: "My passes" },
  ],
  provider: [
    { href: "/provider", label: "My APIs" },
    { href: "/provider/new", label: "Publish" },
  ],
};

/** The workspace a route belongs to, or null for shared routes (home, docs, services, design system). */
export function routeWorkspace(pathname: string): Role | null {
  if (pathname === "/provider" || pathname.startsWith("/provider/")) return "provider";
  if (["/marketplace", "/passes"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return "client";
  return null;
}

/** Whether a nav link is the current page (or a child of it). */
export function isActiveLink(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/provider" && pathname.startsWith(`${href}/`));
}
