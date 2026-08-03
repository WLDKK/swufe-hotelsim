import crypto from "node:crypto";
import prisma from "@/lib/prisma";
import { getSecurityConfig } from "@/lib/security/config";

const EMAIL_VERIFICATION_PREFIX = "email-verification";
const PASSWORD_RESET_PREFIX = "password-reset";

type SecurityTokenPurpose =
  | typeof EMAIL_VERIFICATION_PREFIX
  | typeof PASSWORD_RESET_PREFIX;

type TokenConsumeResult =
  | {
      status: "valid";
      userId: string;
      email: string;
    }
  | {
      status: "invalid" | "expired";
    };

function buildIdentifier(
  purpose: SecurityTokenPurpose,
  userId: string,
  email: string
) {
  return `${purpose}:${userId}:${email.toLowerCase()}`;
}

function buildPurposePrefix(purpose: SecurityTokenPurpose, userId: string) {
  return `${purpose}:${userId}:`;
}

function parseIdentifier(identifier: string) {
  const [purpose, userId, email] = identifier.split(":");

  if (!purpose || !userId || !email) {
    return null;
  }

  return {
    purpose,
    userId,
    email,
  };
}

export function hashSecurityToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function issueSecurityToken(input: {
  purpose: SecurityTokenPurpose;
  userId: string;
  email: string;
  ttlMs: number;
}) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSecurityToken(rawToken);
  const identifier = buildIdentifier(input.purpose, input.userId, input.email);
  const expires = new Date(Date.now() + input.ttlMs);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({
      where: {
        identifier: {
          startsWith: buildPurposePrefix(input.purpose, input.userId),
        },
      },
    }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: tokenHash,
        expires,
      },
    }),
  ]);

  return {
    rawToken,
    expires,
  };
}

async function consumeSecurityToken(input: {
  purpose: SecurityTokenPurpose;
  rawToken: string;
}): Promise<TokenConsumeResult> {
  const tokenHash = hashSecurityToken(input.rawToken);
  const record = await prisma.verificationToken.findUnique({
    where: {
      token: tokenHash,
    },
  });

  if (!record) {
    return { status: "invalid" };
  }

  await prisma.verificationToken.delete({
    where: {
      token: tokenHash,
    },
  });

  const parsedIdentifier = parseIdentifier(record.identifier);
  if (!parsedIdentifier || parsedIdentifier.purpose !== input.purpose) {
    return { status: "invalid" };
  }

  if (record.expires.getTime() < Date.now()) {
    return { status: "expired" };
  }

  return {
    status: "valid",
    userId: parsedIdentifier.userId,
    email: parsedIdentifier.email,
  };
}

async function clearSecurityTokensForUser(
  purpose: SecurityTokenPurpose,
  userId: string
) {
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: {
        startsWith: buildPurposePrefix(purpose, userId),
      },
    },
  });
}

export async function issueEmailVerificationToken(userId: string, email: string) {
  const config = getSecurityConfig();

  return issueSecurityToken({
    purpose: EMAIL_VERIFICATION_PREFIX,
    userId,
    email,
    ttlMs: config.emailVerificationTtlHours * 60 * 60 * 1000,
  });
}

export async function consumeEmailVerificationToken(rawToken: string) {
  return consumeSecurityToken({
    purpose: EMAIL_VERIFICATION_PREFIX,
    rawToken,
  });
}

export async function clearEmailVerificationTokensForUser(userId: string) {
  await clearSecurityTokensForUser(EMAIL_VERIFICATION_PREFIX, userId);
}

export async function issuePasswordResetToken(userId: string, email: string) {
  const config = getSecurityConfig();

  return issueSecurityToken({
    purpose: PASSWORD_RESET_PREFIX,
    userId,
    email,
    ttlMs: config.passwordResetTtlMinutes * 60 * 1000,
  });
}

export async function consumePasswordResetToken(rawToken: string) {
  return consumeSecurityToken({
    purpose: PASSWORD_RESET_PREFIX,
    rawToken,
  });
}

export async function clearPasswordResetTokensForUser(userId: string) {
  await clearSecurityTokensForUser(PASSWORD_RESET_PREFIX, userId);
}
