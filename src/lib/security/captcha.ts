import { getSecurityConfig } from "@/lib/security/config";

type CaptchaVerificationResult = {
  success: boolean;
  skipped: boolean;
  errorCodes: string[];
};

export async function verifyCaptchaToken(
  token: string | null | undefined
): Promise<CaptchaVerificationResult> {
  const config = getSecurityConfig();

  if (!config.captchaEnabled) {
    return {
      success: true,
      skipped: true,
      errorCodes: [],
    };
  }

  if (!token) {
    return {
      success: false,
      skipped: false,
      errorCodes: ["missing-token"],
    };
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: config.turnstileSecretKey!,
        response: token,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return {
      success: false,
      skipped: false,
      errorCodes: ["turnstile-http-error"],
    };
  }

  const payload = (await response.json()) as {
    success?: boolean;
    ["error-codes"]?: string[];
  };

  return {
    success: Boolean(payload.success),
    skipped: false,
    errorCodes: payload["error-codes"] ?? [],
  };
}
