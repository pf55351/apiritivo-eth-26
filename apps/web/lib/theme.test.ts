import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { currentThemePreference, setThemePreference, subscribeTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "./theme";

type RGB = [number, number, number];

function rgb(hex: string): RGB {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255) as RGB;
}

function luminance(color: RGB) {
  const [r, g, b] = color.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: RGB, b: RGB) {
  const values = [luminance(a), luminance(b)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

function mix(foreground: RGB, background: RGB, alpha: number): RGB {
  return foreground.map((value, index) => value * alpha + (background[index] ?? 0) * (1 - alpha)) as RGB;
}

// Read the actual stylesheet, so a later palette edit cannot silently break contrast.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const blocks = {
  dark: css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? "",
  light: css.match(/:root\[data-theme="light"\]\s*\{([^}]+)\}/)?.[1] ?? "",
};

for (const [theme, block] of Object.entries(blocks)) {
  describe(`${theme} palette`, () => {
    const tokens = Object.fromEntries([...block.matchAll(/--ui-([\w-]+):\s*(#[\da-f]{6})/g)].map((match) => [match[1]!, rgb(match[2]!)]));
    // Every token the assertions name must exist in the palette; a typo fails loudly instead of comparing undefined.
    const token = (name: string): RGB => {
      const value = tokens[name];
      if (!value) throw new Error(`missing token --ui-${name}`);
      return value;
    };
    for (const surface of ["canvas", "surface", "surface-raised", "surface-active"]) {
      test(`text and control boundaries on ${surface}`, () => {
        for (const text of ["content", "content-secondary", "muted", "subtle", "accent-text", "success", "warning", "danger"]) {
          expect(contrast(token(text), token(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
        for (const control of ["focus", "border-strong", "primary-border"]) {
          expect(contrast(token(control), token(surface)), `${control} on ${surface}`).toBeGreaterThanOrEqual(3);
        }
      });
    }

    test("state labels on their tinted badge backgrounds", () => {
      for (const surface of ["canvas", "surface", "surface-raised"]) {
        for (const state of ["success", "warning", "danger"]) {
          expect(contrast(token(state), mix(token(state), token(surface), 0.1)), `${state} badge on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(token("accent-text"), mix(rgb("#ff7847"), token(surface), 0.1))).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
}

test("brand button text stays readable on both fill states", () => {
  for (const fill of ["#ff7847", "#ff9465"]) expect(contrast(rgb("#121311"), rgb(fill))).toBeGreaterThanOrEqual(4.5);
});

describe("appearance before first paint", () => {
  for (const prefersDark of [true, false]) {
    test.each(["light", "dark", "system", null, "invalid", '<script>alert("x")</script>'])(`handles saved value %s when system dark is ${prefersDark}`, (value) => {
      const document = { documentElement: { dataset: {} as Record<string, string> } };
      runInNewContext(THEME_INIT_SCRIPT, {
        document,
        matchMedia: (query: string) => {
          expect(query).toBe("(prefers-color-scheme: dark)");
          return { matches: prefersDark };
        },
        localStorage: {
          getItem: (key: string) => {
            expect(key).toBe(THEME_STORAGE_KEY);
            return value;
          },
        },
      });
      // Only "system" follows the computer; anything unknown or missing starts dark.
      const expected =
        value === "system"
          ? { theme: prefersDark ? "dark" : "light", preference: "system" }
          : { theme: value === "light" ? "light" : "dark", preference: value === "light" ? "light" : "dark" };
      expect(document.documentElement.dataset.theme).toBe(expected.theme);
      expect(document.documentElement.dataset.themePreference).toBe(expected.preference);
    });

    test(`blocked storage starts dark when system dark is ${prefersDark}`, () => {
      const document = { documentElement: { dataset: {} as Record<string, string> } };
      runInNewContext(THEME_INIT_SCRIPT, {
        document,
        matchMedia: () => ({ matches: prefersDark }),
        get localStorage() {
          throw new Error("Storage blocked");
        },
      });
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(document.documentElement.dataset.themePreference).toBe("dark");
    });
  }
});

describe("live appearance preference", () => {
  let media: EventTarget & { matches: boolean };
  let host: EventTarget & { matchMedia: () => typeof media; localStorage: { setItem: (key: string, value: string) => void } };
  let dataset: Record<string, string>;
  let saved: Map<string, string>;
  let stop: (() => void) | undefined;
  const globals = new Map<string, PropertyDescriptor | undefined>();

  beforeEach(() => {
    for (const key of ["window", "document"]) globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    media = Object.assign(new EventTarget(), { matches: true });
    saved = new Map();
    dataset = { theme: "dark", themePreference: "system" };
    host = Object.assign(new EventTarget(), {
      matchMedia: () => media,
      localStorage: { setItem: (key: string, value: string) => saved.set(key, value) },
    });
    Object.defineProperty(globalThis, "window", { configurable: true, value: host });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset } } });
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });

  function computerTheme(prefersDark: boolean) {
    media.matches = prefersDark;
    media.dispatchEvent(new Event("change"));
  }

  function storageChange(key: string | null, newValue: string | null, storageArea: unknown = host.localStorage) {
    const event = new Event("storage");
    Object.defineProperties(event, { key: { value: key }, newValue: { value: newValue }, storageArea: { value: storageArea } });
    host.dispatchEvent(event);
  }

  test("Auto follows live changes, overrides stay fixed, and Auto can be restored", () => {
    stop = subscribeTheme(() => {});
    computerTheme(false);
    expect(dataset.theme).toBe("light");
    setThemePreference("dark");
    expect(saved.get(THEME_STORAGE_KEY)).toBe("dark");
    computerTheme(true);
    computerTheme(false);
    expect(dataset.theme).toBe("dark");
    setThemePreference("system");
    expect(currentThemePreference()).toBe("system");
    expect(dataset.theme).toBe("light");
    computerTheme(true);
    expect(dataset.theme).toBe("dark");
  });

  test("mount catches an OS change after the startup script", () => {
    media.matches = false;
    stop = subscribeTheme(() => {});
    expect(dataset.theme).toBe("light");
  });

  test("other tabs synchronize overrides and removing a preference returns to the dark default", () => {
    stop = subscribeTheme(() => {});
    storageChange(THEME_STORAGE_KEY, "light");
    expect(currentThemePreference()).toBe("light");
    expect(dataset.theme).toBe("light");
    storageChange(THEME_STORAGE_KEY, "dark", {});
    storageChange("other-setting", "dark");
    expect(dataset.theme).toBe("light");
    storageChange(THEME_STORAGE_KEY, "system");
    expect(currentThemePreference()).toBe("system");
    expect(dataset.theme).toBe("dark");
    storageChange(THEME_STORAGE_KEY, null);
    expect(dataset.theme).toBe("dark");
    expect(currentThemePreference()).toBe("dark");
    storageChange(THEME_STORAGE_KEY, "light");
    storageChange(null, null);
    expect(currentThemePreference()).toBe("dark");
  });

  test("blocked storage keeps the in-memory override and permits Auto", () => {
    Object.defineProperty(host, "localStorage", {
      get: () => {
        throw new Error("Storage blocked");
      },
    });
    stop = subscribeTheme(() => {});
    setThemePreference("light");
    computerTheme(true);
    expect(dataset.theme).toBe("light");
    setThemePreference("system");
    expect(dataset.theme).toBe("dark");
    computerTheme(false);
    expect(dataset.theme).toBe("light");
  });

  test("unsubscribe removes listeners", () => {
    const unsubscribe = subscribeTheme(() => {});
    unsubscribe();
    computerTheme(false);
    storageChange(THEME_STORAGE_KEY, "light");
    expect(dataset.theme).toBe("dark");
  });
});
