import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const API_URL = process.env.API_URL ?? 'http://reservo-api-dev:3001/api';

// Decode exp claim from JWT without a library
function jwtExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return (payload.exp as number) * 1000; // convert to ms
  } catch {
    return 0;
  }
}

async function refreshAccessToken(refreshToken: string) {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ accessToken: string; refreshToken: string }>;
  } catch {
    return null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed.data),
          });
          if (!res.ok) return null;
          const { accessToken, refreshToken, user } = (await res.json()) as {
            accessToken: string;
            refreshToken: string;
            user: { id: string; email: string; name: string; role: string };
          };
          return { ...user, accessToken, refreshToken };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // ── Initial login ────────────────────────────────────────────────
      if (user) {
        const u = user as typeof user & {
          accessToken: string;
          refreshToken: string;
          role: string;
          id: string;
        };
        return {
          ...token,
          accessToken: u.accessToken,
          refreshToken: u.refreshToken,
          accessTokenExpires: jwtExpiry(u.accessToken),
          role: u.role,
          id: u.id,
          error: undefined,
        };
      }

      // ── Token still valid (30-second buffer before expiry) ───────────
      const expires = (token.accessTokenExpires as number | undefined) ?? 0;
      if (Date.now() < expires - 30_000) {
        return token;
      }

      // ── Access token expired → try to refresh ────────────────────────
      const refreshed = await refreshAccessToken(token.refreshToken as string);
      if (!refreshed) {
        // Refresh failed (token revoked or 7-day TTL passed) → force logout
        return { ...token, error: 'RefreshTokenExpired' as const };
      }

      return {
        ...token,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        accessTokenExpires: jwtExpiry(refreshed.accessToken),
        error: undefined,
      };
    },

    session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string,
        error: token.error,
        user: {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
        },
      };
    },
  },
  pages: { signIn: '/login' },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // match refresh token TTL (7 days)
  },
});
