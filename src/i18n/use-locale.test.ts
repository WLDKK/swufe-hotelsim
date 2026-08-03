import { describe, expect, it } from "vitest";
import { resolvePreferredLocale } from "@/i18n/use-locale";

describe("resolvePreferredLocale", () => {
  it("defaults to zh-CN when no hint exists", () => {
    expect(resolvePreferredLocale(null)).toBe("zh-CN");
    expect(resolvePreferredLocale(undefined)).toBe("zh-CN");
  });

  it("maps zh variants back to the zh-CN bundle", () => {
    expect(resolvePreferredLocale("zh-CN")).toBe("zh-CN");
    expect(resolvePreferredLocale("zh-TW")).toBe("zh-CN");
    expect(resolvePreferredLocale("ZH-hans")).toBe("zh-CN");
  });

  it("falls back to en-US for non-zh locales", () => {
    expect(resolvePreferredLocale("en-US")).toBe("en-US");
    expect(resolvePreferredLocale("fr-FR")).toBe("en-US");
  });
});
