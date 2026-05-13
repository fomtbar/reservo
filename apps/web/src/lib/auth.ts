import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        try {
          const res = await fetch(`${process.env.API_URL}/auth/login`, {
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
    jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          accessToken: string;
          refreshToken: string;
          role: string;
          id: string;
        };
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.role = u.role;
        token.id = u.id;
      }
      return token;
    },
    session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string,
        user: {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
        },
      };
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
});
