import { compare, hash } from "bcryptjs";
import { getSecurityConfig } from "@/lib/security/config";

// Centralize password hashing rules so registration and future password-reset
// flows cannot silently drift onto different bcrypt settings.
function extractPasswordHashCost(passwordHash: string) {
  const match = /^\$2[aby]\$(\d{2})\$/.exec(passwordHash);

  if (!match) {
    return null;
  }

  return Number(match[1]);
}

export function getPasswordHashRounds() {
  return getSecurityConfig().passwordBcryptRounds;
}

export async function hashPassword(plainTextPassword: string) {
  // Reuse the same hashing policy everywhere so stored credentials stay
  // consistent across seed data, registration, and future reset flows.
  return hash(plainTextPassword, getPasswordHashRounds());
}

export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string
) {
  // Keep verification wrapped here so later migrations to another password
  // strategy only need one change point.
  return compare(plainTextPassword, passwordHash);
}

export function needsPasswordHashUpgrade(passwordHash: string) {
  const currentCost = extractPasswordHashCost(passwordHash);

  if (currentCost === null) {
    return true;
  }

  return currentCost < getPasswordHashRounds();
}
