import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { redeemTicket } from "@/lib/login-guard";

// Email + password login. Sessions are signed cookies (JWT), so no session
// table is needed. The password (and, on a new device, the emailed code) is
// checked by the login page, which then hands Auth.js a one-time ticket; see
// src/lib/login-guard.ts. Social login or magic links can be added as extra providers.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { ticket: {} },
      async authorize(raw) {
        if (typeof raw.ticket !== "string" || !raw.ticket) return null;
        const user = await redeemTicket(raw.ticket);
        return user ? { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 0;
        return token;
      }
      // Logged in somewhere else since this session started: log this one out.
      if (!token.sub) return null;
      const current = await db.user.findUnique({ where: { id: token.sub }, select: { sessionVersion: true } });
      if (!current || current.sessionVersion !== token.sessionVersion) return null;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
