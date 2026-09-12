import { describe, expect, test } from "bun:test";
import { checkEndpointSyntax, isPrivateAddress } from "./safe-url";

describe("isPrivateAddress", () => {
  test("flags loopback, RFC1918, link-local, metadata and CGNAT ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.9",
      "172.31.255.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
    ]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });
  test("lets public addresses through", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateAddress(ip)).toBe(false);
  });
  test("anything that is not an IP is treated as private", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("checkEndpointSyntax", () => {
  test("accepts a public https URL", () => {
    const r = checkEndpointSyntax("https://api.example.com/v1/quote");
    expect(r.ok).toBe(true);
  });
  test("refuses http, credentials, localhost and private literals", () => {
    const bad = [
      "http://api.example.com",
      "https://user:pw@api.example.com",
      "https://localhost:3000/api",
      "https://foo.localhost/x",
      "https://127.0.0.1/",
      "https://169.254.169.254/latest/meta-data/",
      "https://[::1]/",
      "https://box.internal/",
      "not a url",
    ];
    for (const url of bad) expect(checkEndpointSyntax(url).ok).toBe(false);
  });
});
