import { compare } from "bcryptjs";
import { getSecurityConfig } from "@/lib/security/config";

const PASSWORD_HASH_ALGORITHM = "pbkdf2-sha256";
const PASSWORD_HASH_PREFIX = `$${PASSWORD_HASH_ALGORITHM}$`;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BITS = 256;

type ParsedPbkdf2Hash = {
  iterations: number;
  peppered: boolean;
  salt: Uint8Array;
  derivedKey: Uint8Array;
};

type RuntimeSubtleCrypto = SubtleCrypto & {
  timingSafeEqual?: (
    left: ArrayBuffer | ArrayBufferView,
    right: ArrayBuffer | ArrayBufferView
  ) => boolean;
};

function toBase64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

function parsePbkdf2Hash(passwordHash: string): ParsedPbkdf2Hash | null {
  const match = /^\$pbkdf2-sha256\$i=(\d+)(?:\$p=([01]))?\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(
    passwordHash
  );
  if (!match) {
    return null;
  }

  const iterations = Number(match[1]);
  const peppered = match[2] === "1";
  const salt = fromBase64Url(match[3]);
  const derivedKey = fromBase64Url(match[4]);
  if (
    !Number.isInteger(iterations) ||
    iterations < 50_000 ||
    iterations > 2_000_000 ||
    salt.byteLength < PASSWORD_SALT_BYTES ||
    derivedKey.byteLength !== PASSWORD_KEY_BITS / 8
  ) {
    return null;
  }

  return { iterations, peppered, salt, derivedKey };
}

async function buildPasswordMaterial(
  plainTextPassword: string,
  peppered: boolean
) {
  const encodedPassword = new TextEncoder().encode(plainTextPassword);
  if (!peppered) {
    return encodedPassword;
  }

  const pepper = getSecurityConfig().passwordPepper;
  if (!pepper) {
    throw new Error(
      "PASSWORD_PEPPER is required to verify this password hash."
    );
  }

  const pepperKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", pepperKey, encodedPassword)
  );
}

async function derivePbkdf2Key(
  plainTextPassword: string,
  salt: Uint8Array,
  iterations: number,
  peppered: boolean
) {
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const passwordMaterial = await buildPasswordMaterial(
    plainTextPassword,
    peppered
  );
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    passwordMaterial,
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBuffer,
      iterations,
    },
    passwordKey,
    PASSWORD_KEY_BITS
  );
  return new Uint8Array(derivedBits);
}

function compareDerivedKeys(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  const subtle = crypto.subtle as RuntimeSubtleCrypto;
  if (typeof subtle.timingSafeEqual === "function") {
    return subtle.timingSafeEqual(left, right);
  }

  // Standard Node Web Crypto does not currently expose Cloudflare's
  // timingSafeEqual extension. Keep tests and local development portable with
  // a fixed-length, non-short-circuiting comparison of the derived key bytes.
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

// Keep bcrypt parsing isolated to the legacy compatibility path. New hashes
// use the runtime-native Web Crypto implementation below so Cloudflare does
// not spend an invocation's JavaScript CPU budget inside bcryptjs.
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

export function getPasswordHashIterations() {
  return getSecurityConfig().passwordPbkdf2Iterations;
}

export async function hashPassword(plainTextPassword: string) {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const config = getSecurityConfig();
  const iterations = config.passwordPbkdf2Iterations;
  const peppered = Boolean(config.passwordPepper);
  const derivedKey = await derivePbkdf2Key(
    plainTextPassword,
    salt,
    iterations,
    peppered
  );

  return `${PASSWORD_HASH_PREFIX}i=${iterations}$p=${peppered ? 1 : 0}$${toBase64Url(salt)}$${toBase64Url(derivedKey)}`;
}

export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string
) {
  const pbkdf2Hash = parsePbkdf2Hash(passwordHash);
  if (pbkdf2Hash) {
    const candidate = await derivePbkdf2Key(
      plainTextPassword,
      pbkdf2Hash.salt,
      pbkdf2Hash.iterations,
      pbkdf2Hash.peppered
    );
    return compareDerivedKeys(candidate, pbkdf2Hash.derivedKey);
  }

  // Existing bcrypt hashes remain valid and are upgraded after a successful
  // login. Reject unknown formats instead of feeding them to bcryptjs.
  return extractPasswordHashCost(passwordHash) === null
    ? false
    : compare(plainTextPassword, passwordHash);
}

export function needsPasswordHashUpgrade(passwordHash: string) {
  const pbkdf2Hash = parsePbkdf2Hash(passwordHash);
  if (pbkdf2Hash) {
    const config = getSecurityConfig();
    return (
      pbkdf2Hash.iterations < config.passwordPbkdf2Iterations ||
      pbkdf2Hash.peppered !== Boolean(config.passwordPepper)
    );
  }

  // Every legacy bcrypt hash should move to the native PBKDF2 format after
  // the user proves possession of the password.
  return true;
}
