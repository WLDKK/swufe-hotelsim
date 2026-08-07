import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import {
  hashPassword,
  needsPasswordHashUpgrade,
  verifyPassword,
} from "./src/lib/auth/passwords";
import { getSecurityConfig } from "./src/lib/security/config";
import { loginSchema } from "./src/lib/validations/auth";
import {
  getUserForCredentials,
  updateUserPasswordHash,
} from "./src/lib/dal/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    // JWT keeps middleware edge-safe while still letting Prisma-backed users
    // sign in with credentials from the database.
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials) {
        // Validate incoming form data before touching the database so auth
        // errors remain predictable and later validation updates only need to
        // happen in one place.
        const parsed = loginSchema.safeParse({
          email: credentials.email,
          password: credentials.password,
        });

        if (!parsed.success) {
          return null;
        }

        const user = await getUserForCredentials(parsed.data.email);
        if (!user?.passwordHash) {
          return null;
        }

        // Credentials auth stays intentionally narrow here:
        // 1. find the user by email
        // 2. verify the current PBKDF2 hash or a legacy bcrypt hash
        // 3. expose only the fields needed for session enrichment
        const isValidPassword = await verifyPassword(
          parsed.data.password,
          user.passwordHash
        );

        if (!isValidPassword) {
          return null;
        }

        if (getSecurityConfig().requireEmailVerification && !user.emailVerified) {
          return null;
        }

        if (needsPasswordHashUpgrade(user.passwordHash)) {
          await updateUserPasswordHash(user.id, await hashPassword(parsed.data.password));
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          studentId: user.studentId,
          locale: user.locale,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // Persist role metadata into the JWT once at sign-in time so middleware
      // and server components can read authorization state without another
      // database round-trip on every request.
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.studentId = user.studentId ?? null;
        token.locale = user.locale;
      }

      return token;
    },
    async session({ session, token }) {
      // Mirror the JWT claims onto `session.user` so app code can rely on one
      // strongly typed shape across layouts, server components, and actions.
      if (session.user) {
        session.user.id = String(token.id ?? token.sub ?? "");
        session.user.role = (token.role as typeof session.user.role) ?? "STUDENT";
        session.user.studentId = (token.studentId as string | null | undefined) ?? null;
        session.user.locale = (token.locale as typeof session.user.locale) ?? "ZH_CN";
      }

      return session;
    },
  },
});
