import { hash as hashWithBcrypt } from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashPassword,
  needsPasswordHashUpgrade,
  verifyPassword,
} from "@/lib/auth/passwords";

describe("password hashing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates salted PBKDF2 hashes and verifies them", async () => {
    vi.stubEnv("PASSWORD_PBKDF2_ITERATIONS", "100000");
    vi.stubEnv("PASSWORD_PEPPER", "");

    const firstHash = await hashPassword("correct horse battery staple");
    const secondHash = await hashPassword("correct horse battery staple");

    expect(firstHash).toMatch(/^\$pbkdf2-sha256\$i=100000\$p=0\$/);
    expect(secondHash).not.toBe(firstHash);
    await expect(
      verifyPassword("correct horse battery staple", firstHash)
    ).resolves.toBe(true);
    await expect(verifyPassword("wrong password", firstHash)).resolves.toBe(
      false
    );
    expect(needsPasswordHashUpgrade(firstHash)).toBe(false);
  });

  it("pre-hashes with a server-side pepper when configured", async () => {
    vi.stubEnv("PASSWORD_PBKDF2_ITERATIONS", "100000");
    vi.stubEnv(
      "PASSWORD_PEPPER",
      "test-only-pepper-with-at-least-thirty-two-characters"
    );

    const passwordHash = await hashPassword("peppered password");

    expect(passwordHash).toMatch(/^\$pbkdf2-sha256\$i=100000\$p=1\$/);
    await expect(
      verifyPassword("peppered password", passwordHash)
    ).resolves.toBe(true);
    expect(needsPasswordHashUpgrade(passwordHash)).toBe(false);

    vi.stubEnv("PASSWORD_PEPPER", "");
    await expect(
      verifyPassword("peppered password", passwordHash)
    ).rejects.toThrow("PASSWORD_PEPPER is required");
    expect(needsPasswordHashUpgrade(passwordHash)).toBe(true);
  });

  it("accepts a legacy bcrypt hash and marks it for migration", async () => {
    const legacyHash = await hashWithBcrypt("legacy password", 10);

    await expect(verifyPassword("legacy password", legacyHash)).resolves.toBe(
      true
    );
    await expect(verifyPassword("wrong password", legacyHash)).resolves.toBe(
      false
    );
    expect(needsPasswordHashUpgrade(legacyHash)).toBe(true);
  });

  it("rejects malformed or unsupported password hashes", async () => {
    await expect(verifyPassword("password", "not-a-password-hash")).resolves.toBe(
      false
    );
    expect(needsPasswordHashUpgrade("not-a-password-hash")).toBe(true);
  });
});
