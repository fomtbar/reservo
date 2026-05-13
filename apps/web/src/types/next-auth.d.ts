import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    error?: 'RefreshTokenExpired';
    user: DefaultSession['user'] & {
      role: string;
      id: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    role?: string;
    id?: string;
    error?: 'RefreshTokenExpired';
  }
}
