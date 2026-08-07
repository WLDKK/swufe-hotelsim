import { getAppBaseUrl } from "@/lib/site-url";

function parseBoolean(value: string | undefined, fallback = false) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number(value ?? fallback);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

export function getSecurityConfig() {
  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
  const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY?.trim() || null;
  const captchaRequested = parseBoolean(process.env.AUTH_ENABLE_CAPTCHA, false);
  const passwordPepper = process.env.PASSWORD_PEPPER?.trim() || null;

  return {
    requireEmailVerification: parseBoolean(
      process.env.AUTH_REQUIRE_EMAIL_VERIFICATION,
      false
    ),
    passwordBcryptRounds: parseInteger(
      process.env.PASSWORD_BCRYPT_ROUNDS,
      12,
      10,
      14
    ),
    passwordPbkdf2Iterations: parseInteger(
      process.env.PASSWORD_PBKDF2_ITERATIONS,
      100_000,
      100_000,
      100_000
    ),
    passwordPepper,
    emailVerificationTtlHours: parseInteger(
      process.env.AUTH_EMAIL_VERIFICATION_TTL_HOURS,
      24,
      1,
      24 * 7
    ),
    passwordResetTtlMinutes: parseInteger(
      process.env.AUTH_PASSWORD_RESET_TTL_MINUTES,
      120,
      15,
      24 * 60
    ),
    turnstileSiteKey,
    turnstileSecretKey,
    captchaEnabled:
      captchaRequested &&
      Boolean(turnstileSiteKey) &&
      Boolean(turnstileSecretKey),
  };
}

export function getSecurityBaseUrl() {
  return getAppBaseUrl();
}

export function isEmailTransportConfigured() {
  return Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);
}
