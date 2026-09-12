import { describe, expect, test } from "bun:test";
import { isActiveLink, routeWorkspace } from "./routes";

describe("routeWorkspace", () => {
  test("provider routes", () => {
    expect(routeWorkspace("/provider")).toBe("provider");
    expect(routeWorkspace("/provider/new")).toBe("provider");
  });
  test("client routes", () => {
    expect(routeWorkspace("/marketplace")).toBe("client");
    expect(routeWorkspace("/passes")).toBe("client");
  });
  test("shared routes belong to no workspace", () => {
    for (const p of ["/", "/docs", "/services/prova-api-65ee", "/design-system", "/providers"]) expect(routeWorkspace(p)).toBeNull();
  });
});

describe("isActiveLink", () => {
  test("exact and nested matches, except the provider root", () => {
    expect(isActiveLink("/marketplace", "/marketplace")).toBe(true);
    expect(isActiveLink("/provider/new", "/provider/new")).toBe(true);
    expect(isActiveLink("/provider/new", "/provider")).toBe(false);
    expect(isActiveLink("/passes", "/marketplace")).toBe(false);
  });
});
